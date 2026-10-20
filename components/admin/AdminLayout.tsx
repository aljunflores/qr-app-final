import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { COLORS } from '@/constants/colors';
import { signOut, useAuth } from '@/lib/auth';
import { getProfile, isAdminRole, type Profile } from '@/lib/profiles';
import { logActivity } from '@/lib/admin';

export type AdminSection = 'dashboard' | 'users' | 'events' | 'attendance' | 'reports' | 'logs';

const NAV: Array<{ key: AdminSection; label: string; icon: keyof typeof Ionicons.glyphMap; href: string }> = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline', href: '/(admin)' },
  { key: 'users', label: 'Users', icon: 'people-outline', href: '/(admin)/users' },
  { key: 'events', label: 'Events', icon: 'calendar-outline', href: '/(admin)/events' },
  { key: 'attendance', label: 'Attendance', icon: 'checkmark-circle-outline', href: '/(admin)/attendance' },
  { key: 'reports', label: 'Reports', icon: 'document-text-outline', href: '/(admin)/reports' },
  { key: 'logs', label: 'System Records', icon: 'list-outline', href: '/(admin)/logs' },
];

type Props = {
  active: AdminSection;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export default function AdminLayout({ active, title, subtitle, children }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 860;
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const checkAccess = useCallback(async () => {
    if (!user) {
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const p = await getProfile(user.id);
      setProfile(p);
    } finally {
      setChecking(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      checkAccess();
    }, [checkAccess])
  );

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Start the audit write before clearing the session, but never make
      // navigation wait on a network request.
      void logActivity('auth.logout', 'session', null, 'Administrator signed out');
      await signOut();
    } finally {
      setSigningOut(false);
      router.replace('/login');
    }
  };

  // Session still restoring, or profile still loading → spinner (never flash
  // "sign in required" / redirect while we don't know yet).
  if (authLoading || checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Checking administrator access...</Text>
      </View>
    );
  }

  // Not logged in at all → send to login.
  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>Sign in required</Text>
        <Text style={styles.deniedText}>Please log in to access the administrator area.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/login')}>
          <Text style={styles.primaryBtnText}>Go to Sign In</Text>
        </Pressable>
      </View>
    );
  }

  // Logged in but not an admin → block regular users.
  if (!profile || !isAdminRole(profile.role)) {
    return (
      <View style={styles.center}>
        <Ionicons name="shield-half-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.deniedTitle}>Administrator only</Text>
        <Text style={styles.deniedText}>
          Your account ({profile?.email ?? user?.email ?? 'unknown'}) does not have administrator
          access. Ask an administrator to set your role to “admin”.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.primaryBtnText}>Back to App</Text>
        </Pressable>
      </View>
    );
  }

  const nav = (
    <>
      {NAV.map((item) => {
        const selected = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => router.replace(item.href as never)}
            style={[styles.navItem, selected && styles.navItemActive, !wide && styles.navItemCompact]}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={selected ? '#FFFFFF' : COLORS.textSecondary}
            />
            <Text style={[styles.navLabel, selected && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={signingOut ? 'Signing out' : 'Logout'}
        disabled={signingOut}
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.navItem,
          !wide && styles.navItemCompact,
          pressed && !signingOut && styles.navItemPressed,
          signingOut && styles.navItemDisabled,
        ]}
      >
        <Ionicons name="log-out-outline" size={20} color={COLORS.textSecondary} />
        <Text style={styles.navLabel}>{signingOut ? 'Signing out...' : 'Logout'}</Text>
      </Pressable>
    </>
  );

  return (
    <View style={styles.root}>
      {wide ? (
        <View style={styles.sidebar}>
          <View style={styles.brand}>
            <Ionicons name="shield-checkmark" size={26} color={COLORS.primary} />
            <View>
              <Text style={styles.brandTitle}>Admin Panel</Text>
              <Text style={styles.brandSub} numberOfLines={1}>
                {profile.full_name || profile.email}
              </Text>
            </View>
          </View>
          <View style={styles.navCol}>{nav}</View>
          <View style={styles.spacer} />
          <View style={styles.sideFoot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to app"
              onPress={() => router.replace('/(tabs)')}
              style={({ pressed }) => [styles.backBtn, pressed && styles.navItemPressed]}
            >
              <Ionicons name="arrow-back-outline" size={16} color={COLORS.primary} />
              <Text style={styles.backBtnText}>Back to app</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.topbar}>
          <View style={styles.topbarRow}>
            <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} />
            <Text style={styles.topbarTitle}>Admin Panel</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to app"
              onPress={() => router.replace('/(tabs)' as never)}
              style={({ pressed }) => [pressed && styles.navItemPressed]}
            >
              <Text style={styles.topbarBack}>App</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navRow}>
            {nav}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={[styles.content, wide && styles.contentWideLayout]}
        contentContainerStyle={[styles.contentInner, wide && styles.contentWide]}
      >
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  deniedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  deniedText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 248,
    backgroundColor: COLORS.card,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingVertical: 20,
    paddingHorizontal: 14,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 18,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  brandSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    maxWidth: 170,
  },
  navCol: {
    gap: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navItemPressed: {
    opacity: 0.7,
  },
  navItemDisabled: {
    opacity: 0.6,
  },
  navItemCompact: {
    marginRight: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navItemActive: {
    backgroundColor: COLORS.primary,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  navLabelActive: {
    color: '#FFFFFF',
  },
  sideFoot: {
    paddingTop: 16,
  },
  spacer: {
    flex: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  topbar: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingTop: 48,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  topbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  topbarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  topbarBack: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentWideLayout: {
    marginLeft: 248,
  },
  contentInner: {
    padding: 20,
    paddingBottom: 48,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  contentWide: {
    maxWidth: 1350,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
});
