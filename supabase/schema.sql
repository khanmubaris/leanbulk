-- Run in Supabase SQL editor.
-- Workout-only relational schema (no JSON snapshot storage).

-- Remove legacy snapshot storage.
drop table if exists public.user_snapshots;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unit_preference text not null default 'kg' check (unit_preference in ('kg', 'lbs')),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workout_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  date date not null,
  type text not null check (type in ('upper', 'lower')),
  notes text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

create table if not exists public.workout_exercises (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  session_id text not null,
  name text not null,
  order_index integer not null check (order_index >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id),
  constraint workout_exercises_session_fk
    foreign key (user_id, session_id)
    references public.workout_sessions(user_id, id)
    on delete cascade
);

create table if not exists public.workout_sets (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  exercise_id text not null,
  set_index integer not null check (set_index > 0),
  weight numeric not null check (weight >= 0),
  reps integer not null check (reps > 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id),
  constraint workout_sets_exercise_fk
    foreign key (user_id, exercise_id)
    references public.workout_exercises(user_id, id)
    on delete cascade
);

create index if not exists idx_workout_sessions_user_date
  on public.workout_sessions(user_id, date desc);

create index if not exists idx_workout_exercises_user_session
  on public.workout_exercises(user_id, session_id, order_index);

create index if not exists idx_workout_exercises_user_name
  on public.workout_exercises(user_id, name);

create index if not exists idx_workout_sets_user_exercise
  on public.workout_sets(user_id, exercise_id, set_index);

alter table public.user_settings enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;

-- user_settings policies
drop policy if exists "Users can read own settings" on public.user_settings;
create policy "Users can read own settings"
on public.user_settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
on public.user_settings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
on public.user_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own settings" on public.user_settings;
create policy "Users can delete own settings"
on public.user_settings
for delete
to authenticated
using (auth.uid() = user_id);

-- workout_sessions policies
drop policy if exists "Users can read own workout sessions" on public.workout_sessions;
create policy "Users can read own workout sessions"
on public.workout_sessions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own workout sessions" on public.workout_sessions;
create policy "Users can insert own workout sessions"
on public.workout_sessions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own workout sessions" on public.workout_sessions;
create policy "Users can update own workout sessions"
on public.workout_sessions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own workout sessions" on public.workout_sessions;
create policy "Users can delete own workout sessions"
on public.workout_sessions
for delete
to authenticated
using (auth.uid() = user_id);

-- workout_exercises policies
drop policy if exists "Users can read own workout exercises" on public.workout_exercises;
create policy "Users can read own workout exercises"
on public.workout_exercises
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own workout exercises" on public.workout_exercises;
create policy "Users can insert own workout exercises"
on public.workout_exercises
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own workout exercises" on public.workout_exercises;
create policy "Users can update own workout exercises"
on public.workout_exercises
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own workout exercises" on public.workout_exercises;
create policy "Users can delete own workout exercises"
on public.workout_exercises
for delete
to authenticated
using (auth.uid() = user_id);

-- workout_sets policies
drop policy if exists "Users can read own workout sets" on public.workout_sets;
create policy "Users can read own workout sets"
on public.workout_sets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own workout sets" on public.workout_sets;
create policy "Users can insert own workout sets"
on public.workout_sets
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own workout sets" on public.workout_sets;
create policy "Users can update own workout sets"
on public.workout_sets
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own workout sets" on public.workout_sets;
create policy "Users can delete own workout sets"
on public.workout_sets
for delete
to authenticated
using (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.workout_sessions to authenticated;
grant select, insert, update, delete on public.workout_exercises to authenticated;
grant select, insert, update, delete on public.workout_sets to authenticated;
