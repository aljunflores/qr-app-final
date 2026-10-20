import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

const MAP: Record<string, { bg: string; fg: string; label: string }> = {
  present: { bg: '#E8F5E9', fg: '#2E7D32', label: 'Present' },
  absent: { bg: '#FFEBEE', fg: '#C62828', label: 'Absent' },
  late: { bg: '#FFF8E1', fg: '#F57F17', label: 'Late' },
};

export function StatusBadge({ status }: { status: string }) {
  const key = String(status ?? '').toLowerCase();
  const conf = MAP[key] ?? { bg: COLORS.surface, fg: COLORS.textSecondary, label: key || '—' };
  return (
    <View style={[styles.badge, { backgroundColor: conf.bg }]}>
      <Text style={[styles.text, { color: conf.fg }]}>{conf.label}</Text>
    </View>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const key = String(role ?? '').toLowerCase();
  const conf =
    key === 'admin' || key === 'administrator'
      ? { bg: '#F3E5F5', fg: '#6A1B9A', label: 'Admin' }
      : key === 'teacher'
        ? { bg: '#E3F2FD', fg: '#1565C0', label: 'Teacher' }
        : { bg: '#ECEFF1', fg: '#455A64', label: 'Student' };
  return (
    <View style={[styles.badge, { backgroundColor: conf.bg }]}>
      <Text style={[styles.text, { color: conf.fg }]}>{conf.label}</Text>
    </View>
  );
}

export function EventStatusBadge({ status }: { status: string }) {
  const key = String(status ?? '').toLowerCase();
  const conf =
    key === 'ongoing'
      ? { bg: '#E8F5E9', fg: '#2E7D32', label: 'Ongoing' }
      : key === 'upcoming'
        ? { bg: '#E3F2FD', fg: '#1565C0', label: 'Upcoming' }
        : key === 'completed'
          ? { bg: '#ECEFF1', fg: '#455A64', label: 'Completed' }
          : { bg: COLORS.surface, fg: COLORS.textSecondary, label: 'No schedule' };
  return (
    <View style={[styles.badge, { backgroundColor: conf.bg }]}>
      <Text style={[styles.text, { color: conf.fg }]}>{conf.label}</Text>
    </View>
  );
}

export function ActiveBadge() {
  return (
    <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
      <Text style={[styles.text, { color: '#2E7D32' }]}>Active</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
