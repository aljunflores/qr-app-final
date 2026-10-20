-- ============================================
-- ADMIN MODULE MIGRATION (idempotent)
-- Run this in Supabase SQL Editor AFTER schema.sql
-- Adds: admin roles, event location, attendance
-- status, and system_logs table for reports.
-- Safe to re-run. Existing app keeps working
-- even if you skip it (the app falls back
-- gracefully), but admin status/location/logs
-- need these columns/tables to persist.
-- ============================================

-- 1. Allow 'admin' / 'administrator' roles in profiles.
-- The original check only allowed student/teacher.
do $$
begin
  alter table public.profiles drop constraint if exists profiles_role_check;
  alter table public.events drop constraint if exists events_created_by_fkey;
exception when others then null;
end $$;

alter table public.profiles
  drop constraint if exists profiles_role_check;

-- Re-add a wider check (drop first in case of name variance)
do $$
begin
  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('student', 'teacher', 'admin', 'administrator'));
exception when duplicate_object then null;
end $$;

-- 2. Events: location + description (optional metadata)
alter table public.events
  add column if not exists location text,
  add column if not exists description text;

-- 3. Attendance: status column (Present / Absent / Late)
alter table public.attendance
  add column if not exists status text not null default 'present';

do $$
begin
  alter table public.attendance drop constraint if exists attendance_status_check;
  alter table public.attendance
    add constraint attendance_status_check
    check (status in ('present', 'absent', 'late'));
exception when duplicate_object then null;
end $$;

-- Backfill: existing rows keep 'present' via default.

-- 4. System/activity log table (admin reports + audit trail)
create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null default 'system',
  entity_id text,
  details text,
  created_at timestamptz not null default now()
);

alter table public.system_logs enable row level security;

-- Helper: true when the caller is an admin/administrator.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'administrator')
  );
$$;

-- 5. ADMIN RLS POLICIES (additive — old policies stay)
-- Profiles: admins can read/update all profiles
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- Events: admins full access
drop policy if exists "Admins can insert events" on public.events;
create policy "Admins can insert events"
  on public.events for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update all events" on public.events;
create policy "Admins can update all events"
  on public.events for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events"
  on public.events for delete
  to authenticated
  using (public.is_admin());

-- Attendance: admins full access
drop policy if exists "Admins can view all attendance" on public.attendance;
create policy "Admins can view all attendance"
  on public.attendance for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can insert attendance" on public.attendance;
create policy "Admins can insert attendance"
  on public.attendance for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update all attendance" on public.attendance;
create policy "Admins can update all attendance"
  on public.attendance for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete attendance" on public.attendance;
create policy "Admins can delete attendance"
  on public.attendance for delete
  to authenticated
  using (public.is_admin());

-- System logs: admins can read/insert; insert open to
-- authenticated users so the app can record audit rows.
drop policy if exists "Admins can view system logs" on public.system_logs;
create policy "Admins can view system logs"
  on public.system_logs for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Authenticated can insert system logs" on public.system_logs;
create policy "Authenticated can insert system logs"
  on public.system_logs for insert
  to authenticated
  with check (true);

-- ============================================
-- PROMOTE YOUR FIRST ADMIN (run manually):
--   update public.profiles
--   set role = 'admin'
--   where email = 'you@school.edu';
-- ============================================
