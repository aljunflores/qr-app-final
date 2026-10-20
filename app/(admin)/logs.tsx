import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import AdminLayout from '@/components/admin/AdminLayout';
import { COLORS } from '@/constants/colors';
import { getSystemLogs, type SystemLog } from '@/lib/admin';

function fmt(iso: string) {
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

export default function AdminLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [fromServer, setFromServer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSystemLogs();
      setLogs(res.logs);
      setFromServer(res.fromServer);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load system records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const q = search.trim().toLowerCase();
  const filtered = logs.filter(
    (l) =>
      !q ||
      l.action.toLowerCase().includes(q) ||
      l.entity.toLowerCase().includes(q) ||
      (l.details ?? '').toLowerCase().includes(q) ||
      (l.actor_email ?? '').toLowerCase().includes(q)
  );

  return (
    <AdminLayout
      active="logs"
      title="System Records"
      subtitle="History of user creation, event changes and attendance corrections."
    >
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search actions, entities, details..."
        placeholderTextColor={COLORS.textSecondary}
      />

      {!loading && !fromServer && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Showing this device’s session log only</Text>
          <Text style={styles.noticeText}>
            The shared system_logs table was not reachable (run supabase/admin-module-migration.sql and
            sign in as admin to see the full cross-device history).
          </Text>
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
        <Text style={styles.empty}>
          No system records yet. Admin actions (user creation, event updates, attendance corrections)
          will appear here.
        </Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((l) => (
            <View key={l.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.action}>{l.action}</Text>
                <Text style={styles.time}>{fmt(l.created_at)}</Text>
              </View>
              <Text style={styles.meta}>
                {l.entity}
                {l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ''} ·{' '}
                {l.actor_email ?? l.actor_id?.slice(0, 8) ?? 'system'}
              </Text>
              {l.details ? <Text style={styles.details}>{l.details}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {!loading && (
        <Pressable style={styles.refresh} onPress={load}>
          <Text style={styles.refreshText}>Refresh records</Text>
        </Pressable>
      )}
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: COLORS.textPrimary, marginBottom: 12,
  },
  notice: {
    backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FFE082',
  },
  noticeTitle: { fontSize: 13, fontWeight: '800', color: '#F57F17', marginBottom: 4 },
  noticeText: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
  center: { alignItems: 'center', paddingVertical: 40 },
  error: { fontSize: 14, color: '#C62828', textAlign: 'center', marginVertical: 6 },
  retry: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 8 },
  retryText: { color: '#fff', fontWeight: '700' },
  empty: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 32, lineHeight: 20 },
  list: { gap: 10 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  action: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, flex: 1 },
  time: { fontSize: 12, color: COLORS.textSecondary },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  details: { fontSize: 13, color: COLORS.textPrimary, marginTop: 6 },
  refresh: {
    marginTop: 14, alignSelf: 'flex-start', backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  refreshText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});
