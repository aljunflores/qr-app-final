import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import AdminLayout from '@/components/admin/AdminLayout';
import { EventStatusBadge } from '@/components/admin/Badges';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { COLORS } from '@/constants/colors';
import {
  createAdminEvent,
  deleteAdminEvent,
  getAllEvents,
  getAllUsers,
  getEventStatus,
  logActivity,
  updateAdminEvent,
  validateEventInput,
  type AdminEvent,
  type EventInput,
  type EventStatus,
} from '@/lib/admin';
import { supabase } from '@/lib/supabase';

type Teacher = { id: string; label: string };

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminEvents() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [modal, setModal] = useState<null | { mode: 'add' | 'edit'; event?: AdminEvent }>(null);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<null | 'start' | 'end'>(null);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'all'>('all');
  const [notice, setNotice] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<AdminEvent | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [evts, users] = await Promise.all([getAllEvents(), getAllUsers()]);
      setEvents(evts);
      setTeachers(
        users
          .filter((u) => u.role === 'teacher')
          .map((u) => ({ id: u.id, label: u.full_name || u.email }))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = events.filter((e) => {
    const q = search.trim().toLowerCase();
    const matchQ =
      !q ||
      e.title.toLowerCase().includes(q) ||
      e.event_code.toLowerCase().includes(q) ||
      (e.location ?? '').toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || getEventStatus(e) === statusFilter;
    return matchQ && matchS;
  });

  const openAdd = () => {
    const now = new Date();
    setTitle('');
    setCode(`EVT-${now.getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`);
    setStart(toLocalInput(now));
    setEnd(toLocalInput(new Date(now.getTime() + 60 * 60 * 1000)));
    setLocation('');
    setDescription('');
    setTeacherId(null);
    setFormError(null);
    setModal({ mode: 'add' });
  };

  const openEdit = (e: AdminEvent) => {
    setTitle(e.title);
    setCode(e.event_code);
    setStart(e.start_time ? toLocalInput(new Date(e.start_time)) : '');
    setEnd(e.end_time ? toLocalInput(new Date(e.end_time)) : '');
    setLocation(e.location ?? '');
    setDescription(e.description ?? '');
    setTeacherId(e.created_by);
    setFormError(null);
    setModal({ mode: 'edit', event: e });
  };

  const openPicker = (which: 'start' | 'end') => {
    const raw = which === 'start' ? start : end;
    const d = raw ? new Date(raw) : new Date();
    setPickerDate(Number.isNaN(d.getTime()) ? new Date() : d);
    setPicker(which);
  };

  const onPick = (ev: DateTimePickerEvent, date?: Date) => {
    if (ev.type === 'dismissed' || !date) {
      if (Platform.OS === 'android') setPicker(null);
      return;
    }
    if (Platform.OS === 'android') {
      const iso = toLocalInput(date);
      if (picker === 'start') setStart(iso);
      else setEnd(iso);
      setPicker(null);
    } else {
      setPickerDate(date);
    }
  };

  const confirmIosPicker = () => {
    const iso = toLocalInput(pickerDate);
    if (picker === 'start') setStart(iso);
    else setEnd(iso);
    setPicker(null);
  };

  const handleSave = async () => {
    setFormError(null);
    let input: EventInput;
    try {
      input = {
        title: title.trim(),
        event_code: code.trim(),
        start_time: start.trim() ? new Date(start.trim()).toISOString() : null,
        end_time: end.trim() ? new Date(end.trim()).toISOString() : null,
        location: location.trim() || null,
        description: description.trim() || null,
      };
    } catch {
      setFormError('Invalid date/time format.');
      return;
    }
    const err = validateEventInput({ ...input, start_time: start.trim() || null, end_time: end.trim() || null });
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      if (modal?.mode === 'edit' && modal.event) {
        await updateAdminEvent(modal.event.id, input);
        if (teacherId && teacherId !== modal.event.created_by) {
          const { error: reassignError } = await supabase
            .from('events')
            .update({ created_by: teacherId })
            .eq('id', modal.event.id);
          if (reassignError) throw new Error(reassignError.message);
          await logActivity('event.reassign', 'event', modal.event.id, `Assigned teacher ${teacherId}`);
        }
        setNotice(`Event “${input.title}” updated.`);
      } else {
        await createAdminEvent(input);
        if (teacherId) {
          const { data } = await supabase
            .from('events')
            .select('id')
            .eq('event_code', input.event_code)
            .maybeSingle();
          const newId = (data as { id?: string } | null)?.id;
          if (newId) {
            await supabase.from('events').update({ created_by: teacherId }).eq('id', newId);
          }
        }
        setNotice(`Event “${input.title}” created.`);
      }
      setModal(null);
      await load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to save event.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await deleteAdminEvent(deleting.id);
      setNotice(`Event “${deleting.title}” deleted.`);
      setDeleting(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete event.');
      setDeleting(null);
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <AdminLayout active="events" title="Events" subtitle="Create, edit, delete and assign teachers.">
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search events, codes, locations..."
          placeholderTextColor={COLORS.textSecondary}
        />
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ New Event</Text>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {(['all', 'upcoming', 'ongoing', 'completed'] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setStatusFilter(s)}
            style={[styles.chip, statusFilter === s && styles.chipActive]}
          >
            <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
              {s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {notice && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
          <Pressable onPress={() => setNotice(null)}>
            <Text style={styles.noticeDismiss}>Dismiss</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>No events found. Create your first event.</Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((e) => (
            <View key={e.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{e.title}</Text>
                  <Text style={styles.cardMeta}>{e.event_code}</Text>
                </View>
                <EventStatusBadge status={getEventStatus(e)} />
              </View>
              <Text style={styles.cardMeta}>
                {fmt(e.start_time)} → {fmt(e.end_time)}
              </Text>
              {e.description ? <Text style={styles.cardDesc} numberOfLines={2}>{e.description}</Text> : null}
              <Text style={styles.cardMeta}>
                📍 {e.location || 'No location'} · 👤 {e.teacher_name || 'Unassigned'} · ✅{' '}
                {e.attendance_count ?? 0} scans
              </Text>
              <View style={styles.cardActions}>
                <Pressable style={styles.editBtn} onPress={() => openEdit(e)}>
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.delBtn} onPress={() => setDeleting(e)}>
                  <Text style={styles.delText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{modal?.mode === 'add' ? 'New Event' : 'Edit Event'}</Text>

            <Text style={styles.label}>Event name</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Founders Day Assembly" placeholderTextColor={COLORS.textSecondary} />

            <Text style={styles.label}>Event code</Text>
            <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="EVT-2026-0001" placeholderTextColor={COLORS.textSecondary} autoCapitalize="characters" />

            <Text style={styles.label}>Start (tap to pick)</Text>
            <Pressable style={styles.input} onPress={() => openPicker('start')}>
              <Text style={styles.inputText}>{start || 'Select start time'}</Text>
            </Pressable>

            <Text style={styles.label}>End (tap to pick)</Text>
            <Pressable style={styles.input} onPress={() => openPicker('end')}>
              <Text style={styles.inputText}>{end || 'Select end time'}</Text>
            </Pressable>

            <Text style={styles.label}>Location</Text>
            <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="e.g. Main Gymnasium" placeholderTextColor={COLORS.textSecondary} />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="What is this event about?"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Assigned teacher</Text>
            <View style={styles.teacherWrap}>
              <Pressable
                onPress={() => setTeacherId(null)}
                style={[styles.teacherChip, teacherId === null && styles.teacherChipActive]}
              >
                <Text style={[styles.teacherText, teacherId === null && styles.teacherTextActive]}>Unassigned</Text>
              </Pressable>
              {teachers.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setTeacherId(t.id)}
                  style={[styles.teacherChip, teacherId === t.id && styles.teacherChipActive]}
                >
                  <Text style={[styles.teacherText, teacherId === t.id && styles.teacherTextActive]} numberOfLines={1}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
              {teachers.length === 0 && <Text style={styles.hint}>No teacher accounts yet.</Text>}
            </View>

            {formError && <Text style={styles.error}>{formError}</Text>}

            <View style={styles.sheetRow}>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setModal(null)} disabled={saving}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSave} disabled={saving}>
                <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {Platform.OS === 'android' && picker !== null && (
        <DateTimePicker value={pickerDate} mode="datetime" display="default" onChange={onPick} />
      )}
      {Platform.OS === 'ios' && picker !== null && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setPicker(null)}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Select {picker === 'start' ? 'start' : 'end'} time</Text>
              <DateTimePicker value={pickerDate} mode="datetime" display="spinner" onChange={onPick} />
              <View style={styles.sheetRow}>
                <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setPicker(null)}>
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={confirmIosPicker}>
                  <Text style={styles.btnPrimaryText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {Platform.OS === 'web' && picker !== null && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPicker(null)}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Use YYYY-MM-DDTHH:mm</Text>
              <TextInput style={styles.input} value={picker === 'start' ? start : end} onChangeText={(v) => (picker === 'start' ? setStart(v) : setEnd(v))} placeholder="2026-10-08T09:00" placeholderTextColor={COLORS.textSecondary} />
              <View style={styles.sheetRow}>
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => setPicker(null)}>
                  <Text style={styles.btnPrimaryText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <ConfirmDialog
        visible={deleting !== null}
        title="Delete event?"
        message={`Delete “${deleting?.title}”? All attendance records for this event will also be removed. This cannot be undone.`}
        busy={busyDelete}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  search: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.textPrimary,
  },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  chipTextActive: { color: '#fff' },
  notice: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, backgroundColor: '#E8F5E9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: '#A5D6A7' },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#2E7D32' },
  noticeDismiss: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },
  center: { alignItems: 'center', paddingVertical: 40 },
  error: { fontSize: 14, color: '#C62828', textAlign: 'center', marginVertical: 6 },
  retry: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 8 },
  retryText: { color: '#fff', fontWeight: '700' },
  empty: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 32 },
  list: { gap: 10 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  cardMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  cardDesc: { fontSize: 13, color: COLORS.textPrimary, marginTop: 6, lineHeight: 18 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  editBtn: { flex: 1, borderRadius: 10, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 9, alignItems: 'center' },
  editText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  delBtn: { flex: 1, borderRadius: 10, backgroundColor: '#FFEBEE', paddingVertical: 9, alignItems: 'center' },
  delText: { fontSize: 13, fontWeight: '700', color: '#C62828' },
  overlay: { flex: 1, backgroundColor: 'rgba(13,27,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '92%' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: COLORS.background, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: COLORS.textPrimary },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  inputText: { fontSize: 15, color: COLORS.textPrimary },
  teacherWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  teacherChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, maxWidth: 200 },
  teacherChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  teacherText: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  teacherTextActive: { color: '#fff' },
  hint: { fontSize: 12, color: COLORS.textSecondary },
  sheetRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnGhost: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  btnGhostText: { fontWeight: '700', color: COLORS.textPrimary },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnPrimaryText: { fontWeight: '700', color: '#fff' },
});
