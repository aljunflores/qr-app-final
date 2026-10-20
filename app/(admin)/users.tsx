import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import AdminLayout from '@/components/admin/AdminLayout';
import { ActiveBadge, RoleBadge } from '@/components/admin/Badges';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { COLORS } from '@/constants/colors';
import {
  deleteUser,
  getAllUsers,
  logActivity,
  updateUserInfo,
  updateUserRole,
  validateUserInput,
  type AdminUser,
} from '@/lib/admin';
import { normalizeRole, type Role } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

const ROLE_FILTERS: Array<{ key: Role | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'student', label: 'Students' },
  { key: 'teacher', label: 'Teachers' },
  { key: 'admin', label: 'Admins' },
];

const ROLE_CHOICES: Role[] = ['student', 'teacher', 'admin'];

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');

  const [modal, setModal] = useState<null | { mode: 'add' | 'edit'; user?: AdminUser }>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await getAllUsers());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchQ =
      !q ||
      u.email.toLowerCase().includes(q) ||
      (u.full_name ?? '').toLowerCase().includes(q);
    const matchR =
      roleFilter === 'all' ||
      (roleFilter === 'admin' ? u.role === 'admin' || u.role === 'administrator' : u.role === roleFilter);
    return matchQ && matchR;
  });

  const openAdd = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('student');
    setFormError(null);
    setModal({ mode: 'add' });
  };

  const openEdit = (u: AdminUser) => {
    setName(u.full_name ?? '');
    setEmail(u.email);
    setPassword('');
    setRole(normalizeRole(u.role));
    setFormError(null);
    setModal({ mode: 'edit', user: u });
  };

  const handleSave = async () => {
    setFormError(null);
    setNotice(null);
    if (modal?.mode === 'edit' && modal.user) {
      const nameErr = validateUserInput(name, email);
      if (nameErr) {
        setFormError(nameErr);
        return;
      }
      setSaving(true);
      try {
        if (normalizeRole(modal.user.role) !== normalizeRole(role)) {
          await updateUserRole(modal.user.id, role);
        }
        await updateUserInfo(modal.user.id, { full_name: name.trim(), role });
        setModal(null);
        setNotice(`User “${name.trim()}” updated.`);
        await load();
      } catch (e: unknown) {
        setFormError(e instanceof Error ? e.message : 'Failed to save user.');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Add mode: create a real auth account, then restore the admin session.
    const baseErr = validateUserInput(name, email);
    if (baseErr) {
      setFormError(baseErr);
      return;
    }
    if (password.length < 6) {
      setFormError('Temporary password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      // Capture the admin session first so we can restore it afterwards.
      let adminSession: { access_token: string; refresh_token: string } | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          adminSession = {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          };
        }
      } catch {
        adminSession = null;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (signUpError) throw new Error(signUpError.message);
      const newId = data.user?.id ?? data.session?.user.id;
      if (!newId) throw new Error('Account created but no user id returned.');

      const { error: profError } = await supabase
        .from('profiles')
        .update({ full_name: name.trim(), role: role === 'admin' ? 'admin' : role })
        .eq('id', newId);
      if (profError) throw new Error(profError.message);

      await logActivity('user.create', 'user', newId, `${name.trim()} (${role})`);

      // The sign-up signs the client in as the new user — switch back.
      try {
        await supabase.auth.signOut();
        if (adminSession) {
          await supabase.auth.setSession(adminSession);
        }
      } catch {
        // Admin simply signs back in from the login screen.
      }

      setModal(null);
      setNotice(`User “${name.trim()}” created.`);
      await load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      const label = deleting.full_name || deleting.email;
      await deleteUser(deleting.id);
      setNotice(`User “${label}” deleted.`);
      setDeleting(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete user.');
      setDeleting(null);
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <AdminLayout active="users" title="Users" subtitle="View, add, edit, delete and assign roles.">
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or email..."
          placeholderTextColor={COLORS.textSecondary}
        />
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add User</Text>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {ROLE_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setRoleFilter(f.key)}
            style={[styles.chip, roleFilter === f.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, roleFilter === f.key && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {notice && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
          <Pressable onPress={() => setNotice(null)}>
            <Text style={styles.noticeDismiss}>Dismiss</Text>
          </Pressable>
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
        <Text style={styles.empty}>No users match your search.</Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((u) => (
            <View key={u.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${u.full_name || u.email}`}
                  onPress={() => openEdit(u)}
                  style={styles.cardInfo}
                >
                  <Text style={styles.cardName}>{u.full_name || '(no name)'}</Text>
                  <Text style={styles.cardEmail}>{u.email}</Text>
                </Pressable>
                <View style={styles.badgeCol}>
                  <RoleBadge role={u.role} />
                  <ActiveBadge />
                </View>
              </View>
              <View style={styles.cardActions}>
                <Pressable style={styles.editBtn} onPress={() => openEdit(u)}>
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.delBtn} onPress={() => setDeleting(u)}>
                  <Text style={styles.delText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{modal?.mode === 'add' ? 'Add User' : 'Edit User'}</Text>

            <Text style={styles.label}>Full name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Jane Doe" placeholderTextColor={COLORS.textSecondary} />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="user@school.edu"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={modal?.mode === 'add'}
            />

            {modal?.mode === 'add' && (
              <>
                <Text style={styles.label}>Temporary password (min 6 chars)</Text>
                <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={COLORS.textSecondary} secureTextEntry />
              </>
            )}

            <Text style={styles.label}>Role</Text>
            <View style={styles.roleRow}>
              {ROLE_CHOICES.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRole(r)}
                  style={[styles.roleChip, role === r && styles.roleChipActive]}
                >
                  <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                    {r === 'admin' ? 'Administrator' : r[0].toUpperCase() + r.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {formError && <Text style={styles.error}>{formError}</Text>}

            <View style={styles.sheetRow}>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setModal(null)} disabled={saving}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSave} disabled={saving}>
                <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={deleting !== null}
        title="Delete user?"
        message={`Remove ${deleting?.full_name || deleting?.email}? Their profile will be deleted and they will lose app access. This cannot be undone.`}
        busy={busyDelete}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </AdminLayout>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  search: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  chipTextActive: {
    color: '#fff',
  },
  notice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
  noticeDismiss: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
  },
  center: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  error: {
    fontSize: 14,
    color: '#C62828',
    textAlign: 'center',
    marginVertical: 6,
  },
  retry: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  empty: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 32,
  },
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  cardInfo: {
    flex: 1,
  },
  badgeCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 9,
    alignItems: 'center',
  },
  editText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  delBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#FFEBEE',
    paddingVertical: 9,
    alignItems: 'center',
  },
  delText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C62828',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13,27,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingVertical: 10,
    alignItems: 'center',
  },
  roleChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  roleTextActive: {
    color: '#fff',
  },
  sheetRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnGhost: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnGhostText: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
  },
  btnPrimaryText: {
    fontWeight: '700',
    color: '#fff',
  },
});
