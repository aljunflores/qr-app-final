import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin' | 'administrator';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at?: string;
};

/** Normalize legacy / variant role strings to the canonical set. */
export function normalizeRole(value: unknown): Role {
  const v = String(value ?? '').toLowerCase().trim();
  if (v === 'admin' || v === 'administrator') return 'admin';
  if (v === 'teacher') return 'teacher';
  return 'student';
}

/** True for admin / administrator accounts. */
export function isAdminRole(role: unknown): boolean {
  const v = String(role ?? '').toLowerCase().trim();
  return v === 'admin' || v === 'administrator';
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: { full_name?: string; role?: Role }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return { error: error?.message ?? null };
}