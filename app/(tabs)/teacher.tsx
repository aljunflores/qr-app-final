import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { createEvent } from '@/lib/database';

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatDateDisplay(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TeacherScreen() {
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [start, setStart] = useState(toLocalISO(new Date()));
  const [end, setEnd] = useState(toLocalISO(new Date(Date.now() + 60 * 60 * 1000)));
  const [payload, setPayload] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Date Picker States
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [androidPickerMode, setAndroidPickerMode] = useState<'date' | 'time'>('date');

  const openPicker = (target: 'start' | 'end') => {
    const currentDate = new Date(target === 'start' ? start : end);
    const validDate = Number.isNaN(currentDate.getTime()) ? new Date() : currentDate;
    setTempDate(validDate);
    setActivePicker(target);
    if (Platform.OS === 'android') {
      setAndroidPickerMode('date');
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setActivePicker(null);
      return;
    }

    if (!selectedDate) return;

    if (Platform.OS === 'android') {
      if (androidPickerMode === 'date') {
        // Step 1: Combine picked date with previous time values, then ask for time
        const updated = new Date(tempDate);
        updated.setFullYear(selectedDate.getFullYear());
        updated.setMonth(selectedDate.getMonth());
        updated.setDate(selectedDate.getDate());
        
        setTempDate(updated);
        setAndroidPickerMode('time'); // Switch dialog to time mode
      } else {
        // Step 2: Combine picked time values, save result, and close
        const updated = new Date(tempDate);
        updated.setHours(selectedDate.getHours());
        updated.setMinutes(selectedDate.getMinutes());

        if (activePicker === 'start') setStart(toLocalISO(updated));
        if (activePicker === 'end') setEnd(toLocalISO(updated));
        setActivePicker(null);
      }
    } else {
      // iOS handling inside modal
      setTempDate(selectedDate);
    }
  };

  const confirmIOSDate = () => {
    if (activePicker === 'start') setStart(toLocalISO(tempDate));
    if (activePicker === 'end') setEnd(toLocalISO(tempDate));
    setActivePicker(null);
  };

  const handleCreateEvent = () => {
    const event = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: start.trim(),
      end: end.trim(),
    };

    if (!event.eventId || !event.title || !event.start || !event.end) {
      setMessage('All fields are required.');
      return;
    }

    const startTime = new Date(event.start).getTime();
    const endTime = new Date(event.end).getTime();
    if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
      setMessage('Invalid date format.');
      return;
    }
    if (startTime >= endTime) {
      setMessage('Start time must be before end time.');
      return;
    }

    createEvent(event)
      .then(() => {
        setMessage('Event saved! Scan the QR with the Scan tab to test it.');
        setPayload(JSON.stringify({ v: 1, ...event }));
      })
      .catch(() => {
        setMessage('Failed to save event. Please try again.');
      });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Create Event QR</Text>
      <Text style={styles.subtitle}>
        Fill in the event details, then scan the generated QR with the Scan tab.
      </Text>

      <Text style={styles.label}>Event Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Founders Day Assembly"
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.label}>Event Code</Text>
      <TextInput
        style={styles.input}
        value={eventId}
        onChangeText={setEventId}
        placeholder="e.g. EVT-2026-0002"
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Start Time</Text>
      <Pressable style={styles.dateSelector} onPress={() => openPicker('start')}>
        <Text style={styles.dateText}>{formatDateDisplay(start)}</Text>
        <Text style={styles.changeBadge}>Select</Text>
      </Pressable>

      <Text style={styles.label}>End Time</Text>
      <Pressable style={styles.dateSelector} onPress={() => openPicker('end')}>
        <Text style={styles.dateText}>{formatDateDisplay(end)}</Text>
        <Text style={styles.changeBadge}>Select</Text>
      </Pressable>

      {/* iOS Modal Spinner */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={activePicker !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setActivePicker(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Select {activePicker === 'start' ? 'Start' : 'End'} Time
                </Text>
                <Pressable onPress={confirmIOSDate}>
                  <Text style={styles.doneButton}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                onChange={handleDateChange}
                textColor={COLORS.textPrimary}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Android Native Dialog (Sequential Date -> Time sequence) */}
      {Platform.OS === 'android' && activePicker !== null && (
        <DateTimePicker
          value={tempDate}
          mode={androidPickerMode}
          display="default"
          onChange={handleDateChange}
        />
      )}

      {message && <Text style={styles.message}>{message}</Text>}

      <AppButton
        theme="primary"
        title="Create Event"
        icon="add-circle-outline"
        onPress={handleCreateEvent}
      />

      {payload && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            Scan this QR code with the Scan tab:
          </Text>
          <View style={styles.qrBox}>
            <QRCode value={payload} size={200} />
          </View>
          <Text style={styles.payloadText}>{payload}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  dateSelector: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  changeBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  doneButton: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  message: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  payloadText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});