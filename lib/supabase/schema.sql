    -- ============================================
    -- PHASE 3: DATABASE SCHEMA
    -- ============================================

    -- 1. PROFILES
    create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null,
    full_name text,
    role text not null default 'student'
        check (role in ('student', 'teacher')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
    );

    -- 2. EVENTS
    create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    event_code text not null unique,
    title text not null,
    start_time timestamptz,
    end_time timestamptz,
    created_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now()
    );

    -- 3. ATTENDANCE
    create table if not exists public.attendance (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references auth.users (id) on delete cascade,
    event_id uuid not null references public.events (id) on delete cascade,
    scanned_at timestamptz not null default now(),
    unique (student_id, event_id)
    );

    -- ============================================
    -- ENABLE ROW LEVEL SECURITY
    -- ============================================

    alter table public.profiles enable row level security;
    alter table public.events enable row level security;
    alter table public.attendance enable row level security;

    -- ============================================
    -- PROFILES POLICIES
    -- ============================================

    drop policy if exists "Profiles are viewable by owner"
    on public.profiles;

    create policy "Profiles are viewable by owner"
    on public.profiles
    for select
    using (auth.uid() = id);

    drop policy if exists "Users can insert their own profile"
    on public.profiles;

    create policy "Users can insert their own profile"
    on public.profiles
    for insert
    with check (auth.uid() = id);

    drop policy if exists "Users can update their own profile"
    on public.profiles;

    create policy "Users can update their own profile"
    on public.profiles
    for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

    -- ============================================
    -- EVENTS POLICIES
    -- ============================================

    drop policy if exists "Events are readable by any authenticated user"
    on public.events;

    create policy "Events are readable by any authenticated user"
    on public.events
    for select
    to authenticated
    using (true);

    drop policy if exists "Users can insert events"
    on public.events;

    create policy "Users can insert events"
    on public.events
    for insert
    to authenticated
    with check (auth.uid() = created_by);

    drop policy if exists "Users can update their own events"
    on public.events;

    create policy "Users can update their own events"
    on public.events
    for update
    to authenticated
    using (auth.uid() = created_by)
    with check (auth.uid() = created_by);

    -- ============================================
    -- ATTENDANCE POLICIES
    -- ============================================

    drop policy if exists "Students can view their own attendance"
    on public.attendance;

    create policy "Students can view their own attendance"
    on public.attendance
    for select
    to authenticated
    using (auth.uid() = student_id);

    drop policy if exists "Students can insert their own attendance"
    on public.attendance;

    create policy "Students can insert their own attendance"
    on public.attendance
    for insert
    to authenticated
    with check (auth.uid() = student_id);

    drop policy if exists "Teachers can view attendance for their events"
    on public.attendance;

    create policy "Teachers can view attendance for their events"
    on public.attendance
    for select
    to authenticated
    using (
    exists (
        select 1
        from public.events
        where events.id = attendance.event_id
        and events.created_by = auth.uid()
    )
    );

    -- ============================================
    -- AUTOMATIC PROFILE CREATION
    -- ============================================

    create or replace function public.handle_new_user()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $$
    begin
    insert into public.profiles (id, email)
    values (new.id, new.email);

    return new;
    end;
    $$;

    drop trigger if exists on_auth_user_created
    on auth.users;

    create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute procedure public.handle_new_user();
