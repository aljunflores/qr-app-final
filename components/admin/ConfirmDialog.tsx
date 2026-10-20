import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.cancel]} onPress={onCancel} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.danger, busy && styles.disabled]}
              onPress={onConfirm}
              disabled={busy}
            >
              <Text style={styles.dangerText}>{busy ? 'Working...' : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 27, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancel: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  danger: {
    backgroundColor: '#C62828',
  },
  dangerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.6,
  },
});
