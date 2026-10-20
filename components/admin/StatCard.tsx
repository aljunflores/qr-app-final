import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { COLORS } from '@/constants/colors';

type Props = {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: string;
  onPress?: () => void;
};

export default function StatCard({ label, value, icon, accent, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${label}: ${value}` : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.cardPressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${accent ?? COLORS.primary}1A` }]}>
        <Ionicons name={icon} size={22} color={accent ?? COLORS.primary} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.75,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
