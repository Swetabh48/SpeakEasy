-- Speakeasy: per-user ownership (run in Supabase SQL editor or via CLI)

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Evaluations (mirrors StoredEval)
create table if not exists public.evaluations (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at bigint not null,
  topic text not null,
  mode text not null,
  exam_name text,
  kind text not null check (kind in ('speech', 'essay')),
  overall_score integer not null,
  band text not null,
  weaknesses jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  dimension_scores jsonb not null default '[]'::jsonb,
  insufficient_evidence boolean not null default false,
  source text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists evaluations_user_at_idx
  on public.evaluations (user_id, at desc);

alter table public.evaluations enable row level security;

create policy "evaluations_select_own"
  on public.evaluations for select
  using (auth.uid() = user_id);

create policy "evaluations_insert_own"
  on public.evaluations for insert
  with check (auth.uid() = user_id);

create policy "evaluations_update_own"
  on public.evaluations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "evaluations_delete_own"
  on public.evaluations for delete
  using (auth.uid() = user_id);

-- Practice history (mirrors HistoryItem)
create table if not exists public.practice_history (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  mode text not null,
  category text not null,
  difficulty text not null,
  practiced_at bigint not null,
  duration_sec integer not null default 0,
  had_recording boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists practice_history_user_practiced_idx
  on public.practice_history (user_id, practiced_at desc);

alter table public.practice_history enable row level security;

create policy "practice_history_select_own"
  on public.practice_history for select
  using (auth.uid() = user_id);

create policy "practice_history_insert_own"
  on public.practice_history for insert
  with check (auth.uid() = user_id);

create policy "practice_history_update_own"
  on public.practice_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "practice_history_delete_own"
  on public.practice_history for delete
  using (auth.uid() = user_id);

-- Single-row user state: seen fingerprints, streak, settings, DAF
create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seen_fingerprints jsonb not null default '[]'::jsonb,
  streak jsonb not null default '{"current":0,"best":0,"lastPracticeDay":null}'::jsonb,
  settings jsonb not null default '{"prepSec":30,"speakSec":60}'::jsonb,
  daf jsonb,
  merged_local_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "user_state_select_own"
  on public.user_state for select
  using (auth.uid() = user_id);

create policy "user_state_insert_own"
  on public.user_state for insert
  with check (auth.uid() = user_id);

create policy "user_state_update_own"
  on public.user_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_state_delete_own"
  on public.user_state for delete
  using (auth.uid() = user_id);

-- Auto-create profile + user_state on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_state (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
