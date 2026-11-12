-- Aurora X demo: saved searches.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Each browser signs in anonymously, so every row belongs to one anonymous
-- user, and row-level security lets people see and change only their own.

create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  place text,
  query text,
  brief text,
  result jsonb,
  created_at timestamptz not null default now()
);

create index if not exists searches_user_recent on public.searches (user_id, created_at desc);

alter table public.searches enable row level security;

drop policy if exists "own searches: read" on public.searches;
create policy "own searches: read" on public.searches
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own searches: add" on public.searches;
create policy "own searches: add" on public.searches
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own searches: delete" on public.searches;
create policy "own searches: delete" on public.searches
  for delete to authenticated using (auth.uid() = user_id);
