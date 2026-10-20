import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, isAdminRole } from '@/lib/profiles';

export default function Index() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!user) {
          if (active) setIsAdmin(false);
          return;
        }
        const p = await getProfile(user.id);
        if (active) setIsAdmin(!!p && isAdminRole(p.role));
      })();
      return () => {
        active = false;
      };
    }, [user])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Header title="QR Attendance" />
      </View>

      <View style={styles.bodyContainer}>
        <Text style={styles.mainTitle}>School Event Attendance</Text>
        <Text style={styles.subtitle}>
          Scan QR Codes to record attendance during school activities.
        </Text>
      </View>

      <View style={styles.footerContainer}>
        <AppButton
          theme="primary"
          title="Scan QR Code"
          icon="qr-code-outline"
          onPress={() => router.push('/scan')}
        />
        <AppButton
          title="Attendance History"
          icon="time-outline"
          onPress={() => router.push('/history')}
        />
        <AppButton
          title="Profile"
          icon="person-outline"
          onPress={() => router.push('/profile')}
        />
        {isAdmin && (
          <AppButton
            title="Administrator Dashboard"
            icon="shield-checkmark-outline"
            onPress={() => router.push('/(admin)' as never)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center' },
  headerContainer: { flex: 1, justifyContent: 'center' },
  bodyContainer: { alignItems: 'center', paddingHorizontal: 32, marginBottom: 16 },
  mainTitle: { fontSize: 18, fontWeight: '600', color: COLORS.primary, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  footerContainer: { flex: 1 / 3, alignItems: 'center', paddingHorizontal: 24, width: '100%' },
});
