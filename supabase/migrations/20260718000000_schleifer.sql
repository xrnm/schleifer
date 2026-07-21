-- Schleifer cloud-sync schema + RLS. Idempotent: safe to run more than once.

create table if not exists public.card_states (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id text not null,
  ease double precision not null,
  interval_days double precision not null,
  reps integer not null,
  due bigint not null,
  lapses integer not null,
  last_shown_at bigint,
  last_result text,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table if not exists public.sessions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  started_at bigint not null,
  ended_at bigint,
  target_count integer not null,
  presented integer not null,
  correct integer not null,
  incorrect integer not null,
  idk integer not null,
  skipped integer not null,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.events (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  kind text not null,
  ts bigint not null,
  session_id text,
  payload jsonb not null,
  primary key (user_id, id)
);
create index if not exists events_user_ts on public.events(user_id, ts);

create table if not exists public.custom_nouns (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null,
  client_updated_at bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.card_states  enable row level security;
alter table public.sessions     enable row level security;
alter table public.events       enable row level security;
alter table public.custom_nouns enable row level security;

drop policy if exists "own rows" on public.card_states;
drop policy if exists "own rows" on public.sessions;
drop policy if exists "own rows" on public.events;
drop policy if exists "own rows" on public.custom_nouns;

create policy "own rows" on public.card_states
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.custom_nouns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Table privileges. RLS still gates rows per policy above; anon/authenticated
-- need base privileges or PostgREST returns 42501 (permission denied). This is
-- the standard Supabase grant set. anon matches auth.uid() = null → 0 rows.
grant all on public.card_states  to anon, authenticated, service_role;
grant all on public.sessions     to anon, authenticated, service_role;
grant all on public.events       to anon, authenticated, service_role;
grant all on public.custom_nouns to anon, authenticated, service_role;


