import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import AdminLayout from '@/components/admin/AdminLayout';
import StatCard from '@/components/admin/StatCard';
import { COLORS } from '@/constants/colors';
import {
  getAllAttendance,
  getAllEvents,
  getDashboardStats,
  type DashboardStats,
} from '@/lib/admin';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [recentScans, setRecentScans] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, events, scans] = await Promise.all([
        getDashboardStats(),
        getAllEvents(),
        getAllAttendance(),
      ]);
      setStats(s);
      setEventCount(events.length);
      setRecentScans(scans.slice(0, 5).length);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const total = (stats?.presentCount ?? 0) + (stats?.absentCount ?? 0) + (stats?.lateCount ?? 0);
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <AdminLayout
      active="dashboard"
      title="Dashboard"
      subtitle="Overall attendance at a glance. Filter deeper in Attendance and Reports."
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.muted}>Loading statistics...</Text>
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
          <View style={styles.grid}>
            <StatCard
              label="Total Students"
              value={stats?.totalStudents ?? 0}
              icon="people-outline"
              accent="#1565C0"
              onPress={() => router.push('/(admin)/users')}
            />
            <StatCard
              label="Total Events"
              value={stats?.totalEvents ?? 0}
              icon="calendar-outline"
              accent="#6A1B9A"
              onPress={() => router.push('/(admin)/events')}
            />
          </View>
          <View style={styles.grid}>
            <StatCard
              label="Present"
              value={stats?.presentCount ?? 0}
              icon="checkmark-circle-outline"
              accent="#2E7D32"
              onPress={() => router.push('/(admin)/attendance')}
            />
            <StatCard
              label="Absent"
              value={stats?.absentCount ?? 0}
              icon="close-circle-outline"
              accent="#C62828"
              onPress={() => router.push('/(admin)/attendance')}
            />
          </View>
          <View style={styles.grid}>
            <StatCard
              label="Late"
              value={stats?.lateCount ?? 0}
              icon="time-outline"
              accent="#F57F17"
              onPress={() => router.push('/(admin)/attendance')}
            />
            <StatCard
              label="Teachers"
              value={stats?.totalTeachers ?? 0}
              icon="school-outline"
              accent="#00838F"
              onPress={() => router.push('/(admin)/users')}
            />
          </View>

          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open attendance report"
              onPress={() => router.push('/(admin)/reports')}
              style={styles.reportLink}
            >
              <Text style={styles.cardTitle}>Attendance mix ({total} records)</Text>
              <Text style={styles.reportLinkText}>View report</Text>
            </Pressable>
            <Bar
              label="Present"
              count={stats?.presentCount ?? 0}
              percent={pct(stats?.presentCount ?? 0)}
              color="#2E7D32"
              onPress={() => router.push('/(admin)/attendance')}
            />
            <Bar
              label="Absent"
              count={stats?.absentCount ?? 0}
              percent={pct(stats?.absentCount ?? 0)}
              color="#C62828"
              onPress={() => router.push('/(admin)/attendance')}
            />
            <Bar
              label="Late"
              count={stats?.lateCount ?? 0}
              percent={pct(stats?.lateCount ?? 0)}
              color="#F57F17"
              onPress={() => router.push('/(admin)/attendance')}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quick facts</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${stats?.totalUsers ?? 0} registered users, ${stats?.totalAdmins ?? 0} admins. Open users.`}
              onPress={() => router.push('/(admin)/users')}
            >
              <Text style={[styles.fact, styles.factLink]}>
                • {stats?.totalUsers ?? 0} registered users ({stats?.totalAdmins ?? 0} admins)
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${eventCount} events in the system. Open events.`}
              onPress={() => router.push('/(admin)/events')}
            >
              <Text style={[styles.fact, styles.factLink]}>• {eventCount} events in the system</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${recentScans} latest scans shown below in Attendance. Open attendance.`}
              onPress={() => router.push('/(admin)/attendance')}
            >
              <Text style={[styles.fact, styles.factLink]}>
                • {recentScans} latest scans shown below in Attendance
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open system records"
              onPress={() => router.push('/(admin)/logs')}
            >
              <Text style={[styles.fact, styles.factLink]}>• View system records</Text>
            </Pressable>
            <Pressable style={styles.refresh} onPress={load}>
              <Text style={styles.refreshText}>Refresh statistics</Text>
            </Pressable>
          </View>
        </>
      )}
    </AdminLayout>
  );
}

function Bar({
  label,
  count,
  percent,
  color,
  onPress,
}: {
  label: string;
  count: number;
  percent: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${count} records, ${percent} percent. Open attendance.`}
      onPress={onPress}
      style={({ pressed }) => [styles.barRow, pressed && styles.barRowPressed]}
    >
      <Text style={styles.barLabel}>
        {label} · {count}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barPct}>{percent}%</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  muted: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  error: {
    fontSize: 14,
    color: '#C62828',
    textAlign: 'center',
    marginBottom: 8,
  },
  retry: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 12,
  },
  barRow: {
    marginBottom: 10,
  },
  barRowPressed: {
    opacity: 0.75,
  },
  barLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  track: {
    height: 10,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: 6,
  },
  barPct: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  fact: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  factLink: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  refresh: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
