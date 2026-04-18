-- ============================================================
-- Freedom Dashboard — Supabase Schema
-- Run this entire file in your Supabase SQL editor once.
-- ============================================================

-- Tasks
create table if not exists tasks (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  text        text        not null,
  completed   boolean     default false not null,
  created_at  timestamptz default now() not null
);

-- Reminders
create table if not exists reminders (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  text        text        not null,
  date        date        not null,
  completed   boolean     default false not null,
  created_at  timestamptz default now() not null
);

-- Notes (one row per user — upsert on user_id)
create table if not exists notes (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null unique,
  content     text        default '' not null,
  updated_at  timestamptz default now() not null
);

-- Day ratings (one per user per date)
create table if not exists day_ratings (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  rating      integer     not null check (rating >= 1 and rating <= 10),
  date        date        default current_date not null,
  created_at  timestamptz default now() not null,
  unique(user_id, date)
);

-- ── Row Level Security ─────────────────────────────────────

alter table tasks       enable row level security;
alter table reminders   enable row level security;
alter table notes       enable row level security;
alter table day_ratings enable row level security;

-- Tasks
create policy "own tasks"
  on tasks for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Reminders
create policy "own reminders"
  on reminders for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Notes
create policy "own notes"
  on notes for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Day ratings
create policy "own day ratings"
  on day_ratings for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── App Authenticator Sign-in ─────────────────────────────

create table if not exists app_auth_users (
  email         text primary key,
  user_id       uuid references auth.users(id) on delete set null unique,
  totp_secret   text not null,
  enrolled_at   timestamptz,
  last_login_at timestamptz,
  created_at    timestamptz default now() not null
);

create table if not exists app_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  created_at  timestamptz default now() not null
);

create index if not exists app_sessions_user_id_idx on app_sessions(user_id);
create index if not exists app_sessions_expires_at_idx on app_sessions(expires_at);
