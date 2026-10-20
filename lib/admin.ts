import { supabase } from './supabase';
import { normalizeRole, type Role } from './profiles';

export type AttendanceStatus = 'present' | 'absent' | 'late';

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at?: string;
};

export type AdminEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  created_by: string | null;
  created_at?: string;
  teacher_name?: string | null;
  attendance_count?: number;
};

export type AdminAttendance = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
  status: AttendanceStatus;
  student_name: string | null;
  student_email: string | null;
  event_title: string;
  event_code: string;
};

export type DashboardStats = {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  totalEvents: number;
  totalScans: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
};

export type SystemLog = {
  id: string;
  actor_id: string | null;
  actor_email?: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
};

export type AttendanceFilters = {
  search?: string;
  eventId?: string;
  status?: AttendanceStatus | 'all';
  date?: string; // YYYY-MM-DD
};

// ---------------------------------------------------------------------------
// Local fallback log buffer (used when system_logs table is missing / RLS
// blocks reads, e.g. before the admin migration SQL has been run).
// ---------------------------------------------------------------------------
const memoryLogs: SystemLog[] = [];

function pushMemoryLog(entry: Omit<SystemLog, 'id' | 'created_at'>) {
  memoryLogs.unshift({
    ...entry,
    id: `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    created_at: new Date().toISOString(),
  });
  if (memoryLogs.length > 200) memoryLogs.length = 200;
}

async function currentActor(): Promise<{ id: string | null; email: string | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { id: user?.id ?? null, email: user?.email ?? null };
  } catch {
    return { id: null, email: null };
  }
}

/** Best-effort audit logging. Never throws. */
export async function logActivity(
  action: string,
  entity: string = 'system',
  entityId: string | null = null,
  details: string | null = null
): Promise<void> {
  const actor = await currentActor();
  pushMemoryLog({
    actor_id: actor.id,
    actor_email: actor.email,
    action,
    entity,
    entity_id: entityId,
    details,
  });
  try {
    await supabase.from('system_logs').insert([
      {
        actor_id: actor.id,
        action,
        entity,
        entity_id: entityId,
        details,
      },
    ]);
  } catch {
    // Table may not exist yet — memory buffer already has the entry.
  }
}

// ---------------------------------------------------------------------------
// Auth / role helpers
// ---------------------------------------------------------------------------
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    const role = String((data as { role?: unknown } | null)?.role ?? '').toLowerCase();
    return role === 'admin' || role === 'administrator';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export async function getAllUsers(search = '', role: Role | 'all' = 'all'): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  let rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id ?? ''),
    email: String(r.email ?? ''),
    full_name: (r.full_name as string | null) ?? null,
    role: normalizeRole(r.role),
    created_at: (r.created_at as string | undefined) ?? undefined,
  }));
  const q = search.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? '').toLowerCase().includes(q)
    );
  }
  if (role !== 'all') {
    rows = rows.filter((u) =>
      role === 'admin' ? u.role === 'admin' || u.role === 'administrator' : u.role === role
    );
  }
  return rows;
}

export function validateUserInput(fullName: string, email: string): string | null {
  if (!fullName.trim()) return 'Full name is required.';
  if (!email.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
  return null;
}

export async function updateUserRole(userId: string, role: Role): Promise<void> {
  if (!userId) throw new Error('Missing user id.');
  const normalized = normalizeRole(role);
  const dbRole = normalized === 'admin' ? 'admin' : normalized;
  const { error } = await supabase.from('profiles').update({ role: dbRole }).eq('id', userId);
  if (error) {
    if (error.message.includes('profiles_role_check') || error.code === '23514') {
      throw new Error(
        'Database still only allows student/teacher roles. Run supabase/admin-module-migration.sql in Supabase first.'
      );
    }
    throw new Error(error.message);
  }
  await logActivity('user.update_role', 'user', userId, `Role set to ${dbRole}`);
}

export async function updateUserInfo(
  userId: string,
  updates: { full_name: string; role: Role }
): Promise<void> {
  const nameError = updates.full_name.trim() ? null : 'Full name is required.';
  if (nameError) throw new Error(nameError);
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: updates.full_name.trim(), role: normalizeRole(updates.role) })
    .eq('id', userId);
  if (error) throw new Error(error.message);
  await logActivity('user.update', 'user', userId, `Updated ${updates.full_name.trim()}`);
}

/**
 * Deletes a user's profile row. Note: Supabase Auth users can only be
 * removed via the service-role key / dashboard, so this removes the
 * public profile (which revokes app access) and records an audit entry.
 */
export async function deleteUser(userId: string): Promise<void> {
  if (!userId) throw new Error('Missing user id.');
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw new Error(error.message);
  await logActivity('user.delete', 'user', userId, 'Profile removed by administrator');
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function mapEventRow(r: Record<string, unknown>): AdminEvent {
  return {
    id: String(r.id ?? ''),
    event_code: String(r.event_code ?? ''),
    title: String(r.title ?? ''),
    start_time: (r.start_time as string | null) ?? null,
    end_time: (r.end_time as string | null) ?? null,
    location: (r.location as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    created_by: (r.created_by as string | null) ?? null,
    created_at: (r.created_at as string | undefined) ?? undefined,
  };
}

export type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'unscheduled';

/** Derive an event's lifecycle status from its start/end times. */
export function getEventStatus(e: Pick<AdminEvent, 'start_time' | 'end_time'>): EventStatus {
  const s = e.start_time ? new Date(e.start_time).getTime() : NaN;
  const t = e.end_time ? new Date(e.end_time).getTime() : NaN;
  if (Number.isNaN(s) && Number.isNaN(t)) return 'unscheduled';
  const now = Date.now();
  if (!Number.isNaN(s) && now < s) return 'upcoming';
  if (!Number.isNaN(t) && now > t) return 'completed';
  return 'ongoing';
}

export async function getAllEvents(search = ''): Promise<AdminEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  let rows = ((data ?? []) as Array<Record<string, unknown>>).map(mapEventRow);

  // Attach teacher names + attendance counts (best effort).
  try {
    const creatorIds = [...new Set(rows.map((e) => e.created_by).filter(Boolean))] as string[];
    let nameById: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', creatorIds);
      ((profs ?? []) as Array<Record<string, unknown>>).forEach((p) => {
        nameById[String(p.id)] = String(p.full_name ?? p.email ?? '');
      });
    }
    const { data: counts } = await supabase.from('attendance').select('event_id');
    const countByEvent: Record<string, number> = {};
    ((counts ?? []) as Array<Record<string, unknown>>).forEach((c) => {
      const k = String(c.event_id ?? '');
      countByEvent[k] = (countByEvent[k] ?? 0) + 1;
    });
    rows = rows.map((e) => ({
      ...e,
      teacher_name: e.created_by ? (nameById[e.created_by] ?? null) : null,
      attendance_count: countByEvent[e.id] ?? 0,
    }));
  } catch {
    // Enrichment is optional; base rows still usable.
  }

  const q = search.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.event_code.toLowerCase().includes(q) ||
        (e.location ?? '').toLowerCase().includes(q)
    );
  }
  return rows;
}

export type EventInput = {
  title: string;
  event_code: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  description?: string | null;
};

export function validateEventInput(input: EventInput): string | null {
  if (!input.title.trim()) return 'Event name is required.';
  if (!input.event_code.trim()) return 'Event code is required.';
  if (input.start_time && input.end_time) {
    const s = new Date(input.start_time).getTime();
    const e = new Date(input.end_time).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return 'Invalid date/time format.';
    if (s >= e) return 'Start time must be before end time.';
  }
  return null;
}

export async function createAdminEvent(input: EventInput): Promise<void> {
  const err = validateEventInput(input);
  if (err) throw new Error(err);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const payload: Record<string, unknown> = {
    event_code: input.event_code.trim(),
    title: input.title.trim(),
    start_time: input.start_time || null,
    end_time: input.end_time || null,
    created_by: user?.id ?? null,
  };
  // Only send optional columns when non-empty; harmless if the migration
  // hasn't been run because we retry without them on schema errors.
  if (input.location?.trim()) payload.location = input.location.trim();
  if (input.description?.trim()) payload.description = input.description.trim();

  let { error } = await supabase.from('events').insert([payload]);
  if (error && (error.code === '42703' || error.message.includes('column'))) {
    delete payload.location;
    delete payload.description;
    ({ error } = await supabase.from('events').insert([payload]));
  }
  if (error) {
    if (error.code === '23505') throw new Error('An event with this code already exists.');
    throw new Error(error.message);
  }
  await logActivity('event.create', 'event', input.event_code.trim(), input.title.trim());
}

export async function updateAdminEvent(id: string, input: EventInput): Promise<void> {
  const err = validateEventInput(input);
  if (err) throw new Error(err);
  if (!id) throw new Error('Missing event id.');
  const payload: Record<string, unknown> = {
    event_code: input.event_code.trim(),
    title: input.title.trim(),
    start_time: input.start_time || null,
    end_time: input.end_time || null,
  };
  if (input.location !== undefined) payload.location = input.location?.trim() || null;
  if (input.description !== undefined) payload.description = input.description?.trim() || null;

  let { error } = await supabase.from('events').update(payload).eq('id', id);
  if (error && (error.code === '42703' || error.message.includes('column'))) {
    delete payload.location;
    delete payload.description;
    ({ error } = await supabase.from('events').update(payload).eq('id', id));
  }
  if (error) {
    if (error.code === '23505') throw new Error('An event with this code already exists.');
    throw new Error(error.message);
  }
  await logActivity('event.update', 'event', id, input.title.trim());
}

export async function deleteAdminEvent(id: string): Promise<void> {
  if (!id) throw new Error('Missing event id.');
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await logActivity('event.delete', 'event', id, 'Event deleted by administrator');
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
function coerceStatus(value: unknown): AttendanceStatus {
  const v = String(value ?? 'present').toLowerCase();
  if (v === 'absent') return 'absent';
  if (v === 'late') return 'late';
  return 'present';
}

export async function getAllAttendance(filters: AttendanceFilters = {}): Promise<AdminAttendance[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*, events ( event_code, title )')
    .order('scanned_at', { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  let rows: AdminAttendance[] = ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const ev = (r.events as Record<string, unknown> | null) ?? null;
    return {
      id: String(r.id ?? ''),
      student_id: String(r.student_id ?? ''),
      event_id: String(r.event_id ?? ''),
      scanned_at: String(r.scanned_at ?? ''),
      status: coerceStatus(r.status),
      student_name: null,
      student_email: null,
      event_title: String(ev?.title ?? ''),
      event_code: String(ev?.event_code ?? ''),
    };
  });

  // Attach student names (best effort — may be RLS-limited to own profile).
  try {
    const ids = [...new Set(rows.map((r) => r.student_id).filter(Boolean))];
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids.slice(0, 200));
      const byId: Record<string, { name: string | null; email: string | null }> = {};
      ((profs ?? []) as Array<Record<string, unknown>>).forEach((p) => {
        byId[String(p.id)] = {
          name: (p.full_name as string | null) ?? null,
          email: (p.email as string | null) ?? null,
        };
      });
      rows = rows.map((r) => ({
        ...r,
        student_name: byId[r.student_id]?.name ?? null,
        student_email: byId[r.student_id]?.email ?? null,
      }));
    }
  } catch {
    // Names are optional enrichment.
  }

  const q = (filters.search ?? '').trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        (r.student_name ?? '').toLowerCase().includes(q) ||
        (r.student_email ?? '').toLowerCase().includes(q) ||
        r.student_id.toLowerCase().includes(q) ||
        r.event_title.toLowerCase().includes(q) ||
        r.event_code.toLowerCase().includes(q)
    );
  }
  if (filters.eventId) rows = rows.filter((r) => r.event_id === filters.eventId);
  if (filters.status && filters.status !== 'all') rows = rows.filter((r) => r.status === filters.status);
  if (filters.date) {
    rows = rows.filter((r) => {
      try {
        return new Date(r.scanned_at).toISOString().slice(0, 10) === filters.date;
      } catch {
        return false;
      }
    });
  }
  return rows;
}

export async function updateAttendanceStatus(id: string, status: AttendanceStatus): Promise<void> {
  if (!id) throw new Error('Missing attendance id.');
  if (!['present', 'absent', 'late'].includes(status)) throw new Error('Invalid status.');
  const { error } = await supabase.from('attendance').update({ status }).eq('id', id);
  if (error) {
    if (error.code === '42703' || error.message.includes('column')) {
      throw new Error(
        'Attendance status column is missing. Run supabase/admin-module-migration.sql in Supabase first.'
      );
    }
    throw new Error(error.message);
  }
  await logActivity('attendance.correct', 'attendance', id, `Status set to ${status}`);
}

export async function deleteAttendance(id: string): Promise<void> {
  if (!id) throw new Error('Missing attendance id.');
  const { error } = await supabase.from('attendance').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await logActivity('attendance.delete', 'attendance', id, 'Record deleted by administrator');
}

// ---------------------------------------------------------------------------
// Dashboard + reports + system records
// ---------------------------------------------------------------------------
export async function getDashboardStats(): Promise<DashboardStats> {
  const [users, events, attendance] = await Promise.all([
    supabase.from('profiles').select('role').limit(2000),
    supabase.from('events').select('id').limit(2000),
    supabase.from('attendance').select('status').limit(5000),
  ]);
  if (users.error) throw new Error(users.error.message);
  if (events.error) throw new Error(events.error.message);

  const roles = ((users.data ?? []) as Array<{ role?: unknown }>).map((u) =>
    String(u.role ?? '').toLowerCase()
  );
  const scans = (attendance.data ?? []) as Array<{ status?: unknown }>;
  const statusMissing = !!attendance.error;

  return {
    totalUsers: roles.length,
    totalStudents: roles.filter((r) => r === 'student').length,
    totalTeachers: roles.filter((r) => r === 'teacher').length,
    totalAdmins: roles.filter((r) => r === 'admin' || r === 'administrator').length,
    totalEvents: (events.data ?? []).length,
    totalScans: statusMissing ? 0 : scans.length,
    presentCount: statusMissing ? 0 : scans.filter((s) => coerceStatus(s.status) === 'present').length,
    absentCount: statusMissing ? 0 : scans.filter((s) => coerceStatus(s.status) === 'absent').length,
    lateCount: statusMissing ? 0 : scans.filter((s) => coerceStatus(s.status) === 'late').length,
  };
}

export async function getSystemLogs(limit = 200): Promise<{ logs: SystemLog[]; fromServer: boolean }> {
  try {
    const { data, error } = await supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    const server = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id ?? ''),
      actor_id: (r.actor_id as string | null) ?? null,
      action: String(r.action ?? ''),
      entity: String(r.entity ?? 'system'),
      entity_id: (r.entity_id as string | null) ?? null,
      details: (r.details as string | null) ?? null,
      created_at: String(r.created_at ?? ''),
    }));
    // Merge local-only entries (e.g. logged before migration) on top.
    const serverIds = new Set(server.map((s) => s.id));
    const localOnly = memoryLogs.filter((m) => !serverIds.has(m.id));
    return { logs: [...localOnly, ...server], fromServer: true };
  } catch {
    return { logs: [...memoryLogs], fromServer: false };
  }
}

/** Build a printable / exportable CSV string from rows. */
export function buildCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

/** Trigger a CSV download on web; returns the CSV text on native. */
export function downloadCsv(filename: string, csv: string): string {
  try {
    const g = globalThis as unknown as {
      document?: Document;
      URL?: typeof URL;
      Blob?: typeof Blob;
    };
    if (g.document && g.URL && g.Blob) {
      const blob = new g.Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = g.URL.createObjectURL(blob);
      const a = g.document.createElement('a');
      a.href = url;
      a.download = filename;
      g.document.body.appendChild(a);
      a.click();
      g.document.body.removeChild(a);
      setTimeout(() => g.URL!.revokeObjectURL(url), 1000);
    }
  } catch {
    // Native: caller shows/shares the returned text.
  }
  return csv;
}
