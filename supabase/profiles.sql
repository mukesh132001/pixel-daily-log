-- Pixel daily log: one saved profile per signed-in user.
-- Paste this whole file into Supabase > SQL Editor > New query, and click Run. It's safe to run twice.
--
-- Row Level Security (RLS) is what keeps this private: the site's public anon key can only ever
-- read, write or delete the row whose user_id is the signed-in person's own id.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,  -- deleting the user deletes the row
  data       jsonb not null,                                                 -- the profile (see cloudCopy in js/profile.js)
  updated_at timestamptz not null default now(),
  constraint profile_size check (pg_column_size(data) < 200000)              -- a profile is a few KB; refuse anything huge
);

alter table public.profiles enable row level security;

drop policy if exists "Read your own profile" on public.profiles;
create policy "Read your own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Create your own profile" on public.profiles;
create policy "Create your own profile" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Update your own profile" on public.profiles;
create policy "Update your own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Delete your own profile" on public.profiles;
create policy "Delete your own profile" on public.profiles
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Nobody who isn't signed in gets anything.
revoke all on public.profiles from anon;
