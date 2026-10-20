import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import AdminLayout from '@/components/admin/AdminLayout';
import { StatusBadge } from '@/components/admin/Badges';
import StatCard from '@/components/admin/StatCard';
import { COLORS } from '@/constants/colors';
import {
  buildCsv,
  downloadCsv,
  getAllAttendance,
  getAllEvents,
  getDashboardStats,
  type AdminEvent,
  type AttendanceStatus,
  type DashboardStats,
} from '@/lib/admin';

export default function AdminReports() {
  const [records, setRecords] = useState<Awaited<ReturnType<typeof getAllAttendance>>>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [eventId, setEventId] = useState<string | 'all'>('all');
  const [status, setStatus] = useState<AttendanceStatus | 'all'>('all');
  const [date, setDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recs, evts, dash] = await Promise.all([
        getAllAttendance(),
        getAllEvents(),
        getDashboardStats().catch(() => null),
      ]);
      setRecords(recs);
      setEvents(evts);
      setStats(dash);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load report data.');
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
        !r.event_title.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [records, search, eventId, status, date]);

  const present = filtered.filter((r) => r.status === 'present').length;
  const absent = filtered.filter((r) => r.status === 'absent').length;
  const late = filtered.filter((r) => r.status === 'late').length;
  const total = filtered.length;
  // Attendance rate counts present + late as attended; present rate is strict.
  const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  const presentRate = total > 0 ? Math.round((present / total) * 100) : 0;

  const handleExport = () => {
    const csv = buildCsv(
      ['Student', 'Email', 'Event', 'Event Code', 'Status', 'Date/Time'],
      filtered.map((r) => [
        r.student_name ?? '',
        r.student_email ?? '',
        r.event_title,
        r.event_code,
        r.status,
        new Date(r.scanned_at).toLocaleString(),
      ])
    );
    const out = downloadCsv(`attendance-report-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    if (Platform.OS !== 'web') {
      Alert.alert('Report exported', `CSV ready (${filtered.length} rows).`, [{ text: 'OK' }]);
      void out;
    }
  };

  const handlePrint = () => {
    const g = globalThis as unknown as { print?: () => void };
    if (Platform.OS === 'web' && typeof g.print === 'function') {
      g.print();
    } else {
      Alert.alert('Print', 'Use Export CSV on mobile, or open the web version and press Print to print this report.');
    }
  };

  return (
    <AdminLayout
      active="reports"
      title="Reports"
      subtitle="Filterable attendance reports with print and CSV export."
    >
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Filter by student, email or event..."
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.filterLabel}>Event</Text>
      <View style={styles.chips}>
        <Pressable onPress={() => setEventId('all')} style={[styles.chip, eventId === 'all' && styles.chipActive]}>
          <Text style={[styles.chipText, eventId === 'all' && styles.chipTextActive]}>All</Text>
        </Pressable>
        {events.slice(0, 12).map((e) => (
          <Pressable key={e.id} onPress={() => setEventId(e.id)} style={[styles.chip, eventId === e.id && styles.chipActive]}>
            <Text style={[styles.chipText, eventId === e.id && styles.chipTextActive]} numberOfLines={1}>
              {e.title}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row2}>
        <View style={styles.col}>
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
        <View style={styles.col}>
          <Text style={styles.filterLabel}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={[styles.search, styles.noMargin]}
            value={date}
            onChangeText={setDate}
            placeholder="2026-10-08"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>
      </View>

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
      ) : (
        <>
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats?.totalStudents ?? '—'}</Text>
              <Text style={styles.summaryLabel}>Total students</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{attendanceRate}%</Text>
              <Text style={styles.summaryLabel}>Attendance rate</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{presentRate}%</Text>
              <Text style={styles.summaryLabel}>Present rate</Text>
            </View>
          </View>
          <View style={styles.grid}>
            <StatCard label="Rows" value={filtered.length} icon="document-text-outline" accent="#1565C0" />
            <StatCard label="Present" value={present} icon="checkmark-circle-outline" accent="#2E7D32" />
          </View>
          <View style={styles.grid}>
            <StatCard label="Absent" value={absent} icon="close-circle-outline" accent="#C62828" />
            <StatCard label="Late" value={late} icon="time-outline" accent="#F57F17" />
          </View>

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleExport}>
              <Text style={styles.btnPrimaryText}>Export CSV</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={handlePrint}>
              <Text style={styles.btnGhostText}>Print</Text>
            </Pressable>
          </View>

          {filtered.length === 0 ? (
            <Text style={styles.empty}>No rows match these report filters.</Text>
          ) : (
            <View style={styles.table}>
              <View style={[styles.tr, styles.trHead]}>
                <Text style={[styles.th, styles.cStudent]}>Student</Text>
                <Text style={[styles.th, styles.cEvent]}>Event</Text>
                <Text style={[styles.th, styles.cStatus]}>Status</Text>
                <Text style={[styles.th, styles.cDate]}>Date</Text>
              </View>
              {filtered.slice(0, 100).map((r) => (
                <View key={r.id} style={styles.tr}>
                  <Text style={[styles.td, styles.cStudent]} numberOfLines={1}>
                    {r.student_name || r.student_email || '—'}
                  </Text>
                  <Text style={[styles.td, styles.cEvent]} numberOfLines={1}>
                    {r.event_title || r.event_code}
                  </Text>
                  <View style={styles.cStatus}>
                    <StatusBadge status={r.status} />
                  </View>
                  <Text style={[styles.td, styles.cDate]} numberOfLines={1}>
                    {new Date(r.scanned_at).toLocaleDateString()}
                  </Text>
                </View>
              ))}
              {filtered.length > 100 && (
                <Text style={styles.more}>Showing 100 of {filtered.length} rows — export CSV for the full report.</Text>
              )}
            </View>
          )}
        </>
      )}
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.textPrimary, marginBottom: 4,
  },
  noMargin: { marginBottom: 0 },
  filterLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginTop: 8, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  chipTextActive: { color: '#fff' },
  row2: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  col: { flex: 1, minWidth: 220 },
  center: { alignItems: 'center', paddingVertical: 40 },
  error: { fontSize: 14, color: '#C62828', textAlign: 'center', marginVertical: 6 },
  retry: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 8 },
  retryText: { color: '#fff', fontWeight: '700' },
  grid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  summary: { flexDirection: 'row', gap: 12, marginTop: 12, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnPrimaryText: { fontWeight: '700', color: '#fff' },
  btnGhost: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  btnGhostText: { fontWeight: '700', color: COLORS.textPrimary },
  empty: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 24 },
  table: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 },
  trHead: { backgroundColor: COLORS.background, borderTopWidth: 0 },
  th: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase' as never },
  td: { fontSize: 13, color: COLORS.textPrimary },
  cStudent: { flex: 1.4 },
  cEvent: { flex: 1.4 },
  cStatus: { flex: 0.9 },
  cDate: { flex: 0.9 },
  more: { fontSize: 12, color: COLORS.textSecondary, padding: 12, textAlign: 'center' },
});
