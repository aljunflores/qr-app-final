import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import AdminLayout from '@/components/admin/AdminLayout';
import { StatusBadge } from '@/components/admin/Badges';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { COLORS } from '@/constants/colors';
import {
  deleteAttendance,
  getAllAttendance,
  getAllEvents,
  updateAttendanceStatus,
  type AdminAttendance,
  type AdminEvent,
  type AttendanceStatus,
} from '@/lib/admin';

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminAttendanceScreen() {
  const [records, setRecords] = useState<AdminAttendance[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [eventId, setEventId] = useState<string | 'all'>('all');
  const [status, setStatus] = useState<AttendanceStatus | 'all'>('all');
  const [date, setDate] = useState('');

  const [editing, setEditing] = useState<AdminAttendance | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('present');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<AdminAttendance | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recs, evts] = await Promise.all([getAllAttendance(), getAllEvents()]);
      setRecords(recs);
      setEvents(evts);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load attendance.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (eventId !== 'all' && r.event_id !== eventId) return false;
      if (status !== 'all' && r.status !== status) return false;
      if (date.trim()) {
        try {
          if (new Date(r.scanned_at).toISOString().slice(0, 10) !== date.trim()) return false;
        } catch {
          return false;
        }
      }
      if (
        q &&
        !(r.student_name ?? '').toLowerCase().includes(q) &&
        !(r.student_email ?? '').toLowerCase().includes(q) &&
        !r.student_id.toLowerCase().includes(q) &&
        !r.event_title.toLowerCase().includes(q) &&
        !r.event_code.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [records, search, eventId, status, date]);

  const openEdit = (r: AdminAttendance) => {
    setEditing(r);
    setEditStatus(r.status);
    setEditError(null);
  };

  const handleSaveStatus = async () => {
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    try {
      await updateAttendanceStatus(editing.id, editStatus);
      setNotice(`Attendance for ${editing.student_name || editing.student_email || 'student'} set to ${editStatus}.`);
      setEditing(null);
      await load();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : 'Failed to update record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await deleteAttendance(deleting.id);
      setNotice('Attendance record deleted.');
      setDeleting(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete record.');
      setDeleting(null);
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <AdminLayout
      active="attendance"
      title="Attendance"
      subtitle="Search, correct and manage every attendance record."
    >
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search student, student ID, email, event..."
        placeholderTextColor={COLORS.textSecondary}
      />

      <View style={styles.filterRow}>
        <View style={styles.filterCol}>
          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.chips}>
            {(['all', 'present', 'absent', 'late'] as const).map((s) => (
              <Pressable key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s && styles.chipActive]}>
                <Text style={[styles.chipText, status === s && styles.chipTextActive]}>
                  {s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Text style={styles.filterLabel}>Event</Text>
      <View style={styles.chips}>
        <Pressable onPress={() => setEventId('all')} style={[styles.chip, eventId === 'all' && styles.chipActive]}>
          <Text style={[styles.chipText, eventId === 'all' && styles.chipTextActive]}>All events</Text>
        </Pressable>
        {events.slice(0, 12).map((e) => (
          <Pressable key={e.id} onPress={() => setEventId(e.id)} style={[styles.chip, eventId === e.id && styles.chipActive]}>
            <Text style={[styles.chipText, eventId === e.id && styles.chipTextActive]} numberOfLines={1}>
              {e.title}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.filterLabel}>Date (YYYY-MM-DD, optional)</Text>
      <View style={styles.dateRow}>
        <TextInput
          style={[styles.search, styles.dateInput]}
          value={date}
          onChangeText={setDate}
          placeholder="2026-10-08"
          placeholderTextColor={COLORS.textSecondary}
        />
        {date ? (
          <Pressable style={styles.clearBtn} onPress={() => setDate('')}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.count}>
        {filtered.length} of {records.length} records
      </Text>

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
        <Text style={styles.empty}>No attendance records match these filters.</Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{r.student_name || r.student_email || 'Unknown student'}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    ID: {r.student_id}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {r.event_title || r.event_code} · {fmtDateTime(r.scanned_at)}
                  </Text>
                </View>
                <StatusBadge status={r.status} />
              </View>
              <View style={styles.cardActions}>
                <Pressable style={styles.editBtn} onPress={() => openEdit(r)}>
                  <Text style={styles.editText}>Correct</Text>
                </Pressable>
                <Pressable style={styles.delBtn} onPress={() => setDeleting(r)}>
                  <Text style={styles.delText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Correct attendance</Text>
            <Text style={styles.sheetSub}>
              {editing?.student_name || editing?.student_email} · {editing?.event_title}
            </Text>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.chips}>
              {(['present', 'absent', 'late'] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setEditStatus(s)}
                  style={[styles.statusPick, editStatus === s && styles.statusPickActive]}
                >
                  <Text style={[styles.statusPickText, editStatus === s && styles.statusPickTextActive]}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {editError && <Text style={styles.error}>{editError}</Text>}
            <View style={styles.sheetRow}>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setEditing(null)} disabled={saving}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSaveStatus} disabled={saving}>
                <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : 'Save correction'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={deleting !== null}
        title="Delete record?"
        message="Permanently remove this attendance record? This cannot be undone."
        busy={busyDelete}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.textPrimary, marginBottom: 10,
  },
  filterRow: { marginBottom: 4 },
  filterCol: { marginBottom: 4 },
  filterLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginTop: 8, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  chipTextActive: { color: '#fff' },
  dateRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dateInput: { flex: 1, marginBottom: 0 },
  clearBtn: { borderRadius: 10, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 11 },
  clearText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  count: { fontSize: 12, color: COLORS.textSecondary, marginTop: 10, marginBottom: 8 },
  notice: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, backgroundColor: '#E8F5E9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: '#A5D6A7' },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#2E7D32' },
  noticeDismiss: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },
  center: { alignItems: 'center', paddingVertical: 40 },
  error: { fontSize: 14, color: '#C62828', textAlign: 'center', marginVertical: 6 },
  retry: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 8 },
  retryText: { color: '#fff', fontWeight: '700' },
  empty: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 32 },
  list: { gap: 10 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8 },
  editBtn: { flex: 1, borderRadius: 10, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 9, alignItems: 'center' },
  editText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  delBtn: { flex: 1, borderRadius: 10, backgroundColor: '#FFEBEE', paddingVertical: 9, alignItems: 'center' },
  delText: { fontSize: 13, fontWeight: '700', color: '#C62828' },
  overlay: { flex: 1, backgroundColor: 'rgba(13,27,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  sheetSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 6 },
  statusPick: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background, paddingVertical: 12, alignItems: 'center' },
  statusPickActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statusPickText: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  statusPickTextActive: { color: '#fff' },
  sheetRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnGhost: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  btnGhostText: { fontWeight: '700', color: COLORS.textPrimary },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnPrimaryText: { fontWeight: '700', color: '#fff' },
});
