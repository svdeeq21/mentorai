-- ═══════════════════════════════════════════════════════
-- MentorAI Production Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ── Jobs table (tracks pipeline progress) ────────────────
create table public.jobs (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references public.profiles(id) on delete cascade,
  document_id   uuid,
  status        text default 'queued',   -- queued | running | complete | failed
  progress      int  default 0,          -- 0-100
  message       text default '',
  error         text default '',
  completed_at  timestamptz,
  created_at    timestamptz default now()
);

alter table public.jobs enable row level security;
create policy "own jobs" on public.jobs for all using (auth.uid() = user_id);

-- ── Subscriptions table ───────────────────────────────────
create table public.subscriptions (
  id                  uuid default uuid_generate_v4() primary key,
  user_id             uuid references public.profiles(id) on delete cascade,
  plan                text default 'free',   -- free | pro | team
  status              text default 'none',   -- none | pending | active | cancelled
  tx_ref              text default '',
  current_period_end  timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.subscriptions enable row level security;
create policy "own subscription" on public.subscriptions for all using (auth.uid() = user_id);

-- ── Usage table (daily message + doc counts) ──────────────
create table public.usage (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references public.profiles(id) on delete cascade,
  date            date default current_date,
  messages_sent   int  default 0,
  docs_indexed    int  default 0,
  created_at      timestamptz default now(),
  unique(user_id, date)
);

alter table public.usage enable row level security;
create policy "own usage" on public.usage for all using (auth.uid() = user_id);

-- ── Add status column to documents table ──────────────────
alter table public.documents
  add column if not exists status text default 'ready';

-- ── Index for fast document lookups ───────────────────────
create index if not exists idx_documents_user_id on public.documents(user_id);
create index if not exists idx_jobs_user_id       on public.jobs(user_id);
create index if not exists idx_chat_messages_session on public.chat_messages(session_id);
create index if not exists idx_usage_user_date    on public.usage(user_id, date);
