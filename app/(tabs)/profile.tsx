import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import { getProfile, updateProfile, type Profile, isAdminRole } from '@/lib/profiles';

function getInitials(name: string | null | undefined) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return '?';
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draftName, setDraftName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const nextProfile = await getProfile(user.id);
    setProfile(nextProfile);
    setDraftName(nextProfile?.full_name ?? '');
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleSaveName = async () => {
    if (!user) return;
    const fullName = draftName.trim();
    if (!fullName) {
      Alert.alert('Name required', 'Enter your name before saving.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await updateProfile(user.id, { full_name: fullName });
      if (error) {
        Alert.alert('Unable to update name', error);
        return;
      }

      setProfile((current) =>
        current
          ? {
              ...current,
              full_name: fullName,
            }
          : current
      );
      setDraftName(fullName);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancelNameEdit = () => {
    setDraftName(profile?.full_name ?? '');
    setEditing(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (err: unknown) {
      Alert.alert(
        'Unable to sign out',
        err instanceof Error ? err.message : 'Failed to sign out.'
      );
    } finally {
      setSigningOut(false);
    }
  };

  const fullName = profile?.full_name?.trim() || 'Student';
  const email = profile?.email || user?.email || '';
  const roleLabel = profile?.role === 'teacher'
    ? 'Teacher'
    : isAdminRole(profile?.role)
      ? 'Administrator'
      : 'Student';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
          <Text style={styles.title}>My Profile</Text>
          <Text style={styles.subtitle}>Your details and account settings.</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="person-outline" size={22} color={COLORS.primary} />
        </View>
      </View>

      <View style={styles.identityCard}>
        <View style={styles.identityTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(profile?.full_name)}</Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.identityName} numberOfLines={2}>{fullName}</Text>
            <Text style={styles.identityEmail} numberOfLines={1}>{email}</Text>
          </View>
        </View>
        <View style={[styles.roleBadge, profile?.role === 'teacher' && styles.teacherBadge, isAdminRole(profile?.role) && styles.adminBadge]}>
          <Ionicons
            name={isAdminRole(profile?.role) ? 'shield-checkmark-outline' : profile?.role === 'teacher' ? 'school-outline' : 'school-outline'}
            size={14}
            color={profile?.role === 'teacher' ? '#6A1B9A' : isAdminRole(profile?.role) ? '#6A1B9A' : '#1565C0'}
          />
          <Text style={[styles.roleText, profile?.role === 'teacher' && styles.teacherRoleText, isAdminRole(profile?.role) && styles.adminRoleText]}>
            {roleLabel}
          </Text>
        </View>
      </View>

      <View style={styles.detailsCard}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Account information</Text>
          <Text style={styles.sectionCaption}>Personal details linked to your account</Text>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="person-outline" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.detailBody}>
            <Text style={styles.detailLabel}>Full name</Text>
            {editing ? (
              <View style={styles.editForm}>
                <TextInput
                  style={styles.nameInput}
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Enter your name"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="words"
                  editable={!saving}
                  accessibilityLabel="Full name"
                />
                <View style={styles.editActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={cancelNameEdit}
                    disabled={saving}
                    style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleSaveName}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.saveButton,
                      pressed && styles.buttonPressed,
                      saving && styles.buttonDisabled,
                    ]}
                  >
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.nameValueRow}>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {profile?.full_name || 'Add your name'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit full name"
                  onPress={() => setEditing(true)}
                  style={({ pressed }) => [styles.editButton, pressed && styles.buttonPressed]}
                >
                  <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <DetailRow
          icon="mail-outline"
          label="Email address"
          value={email || 'Not available'}
        />

        <View style={styles.divider} />

        <DetailRow
          icon="finger-print-outline"
          label="Account ID"
          value={profile?.id ?? user?.id ?? 'Not available'}
          small
        />
      </View>

      {profile && isAdminRole(profile.role) && (
        <AppButton
          theme="primary"
          title="Open Administrator Dashboard"
          icon="shield-checkmark-outline"
          onPress={() => router.replace('/(admin)' as never)}
        />
      )}

      <AppButton
        title={signingOut ? 'Signing Out...' : 'Sign Out'}
        icon="log-out-outline"
        onPress={handleSignOut}
      />
      <Text style={styles.footerNote}>QR Attendance · {roleLabel} account</Text>
    </ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  small = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text selectable style={[styles.detailValue, small && styles.idValue]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  eyebrow: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEC',
  },
  identityCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F8CACA',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  identityText: {
    flex: 1,
  },
  identityName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  identityEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#EAF3FF',
  },
  teacherBadge: {
    backgroundColor: '#F3E8FF',
  },
  adminBadge: {
    backgroundColor: '#F3E8FF',
  },
  roleText: {
    color: '#1565C0',
    fontSize: 12,
    fontWeight: '700',
  },
  teacherRoleText: {
    color: '#6A1B9A',
  },
  adminRoleText: {
    color: '#6A1B9A',
  },
  detailsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeading: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionCaption: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FDECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBody: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  detailValue: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  idValue: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 48,
  },
  nameValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#FDECEC',
  },
  editButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  editForm: {
    gap: 10,
  },
  nameInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: COLORS.background,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footerNote: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
});
