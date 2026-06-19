-- Search Console Peek — user analytics schema.
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).

create extension if not exists "pgcrypto";

create table if not exists public.app_users (
  id           uuid primary key default gen_random_uuid(),
  google_sub   text unique not null,          -- stable Google account id
  email        text not null,
  name         text,
  avatar_url   text,
  properties   text[] not null default '{}',  -- Search Console properties seen
  visit_count  integer not null default 0,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

create index if not exists app_users_last_seen_idx on public.app_users (last_seen desc);

-- Lock the table down. No anon/authenticated access; the edge functions use
-- the service-role key, which bypasses RLS. This means the public anon key
-- (shipped in the extension/site) can never read or write user data directly.
alter table public.app_users enable row level security;

-- Atomic upsert: insert a new user or, on repeat visits, refresh their profile,
-- union in any new properties, bump the visit count, and touch last_seen.
create or replace function public.record_user(
  p_sub        text,
  p_email      text,
  p_name       text,
  p_avatar     text,
  p_properties text[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users
    (google_sub, email, name, avatar_url, properties, visit_count, first_seen, last_seen)
  values
    (p_sub, p_email, p_name, p_avatar, coalesce(p_properties, '{}'), 1, now(), now())
  on conflict (google_sub) do update set
    email       = excluded.email,
    name        = coalesce(excluded.name, app_users.name),
    avatar_url  = coalesce(excluded.avatar_url, app_users.avatar_url),
    properties  = (
      select coalesce(array_agg(distinct p), '{}')
      from unnest(app_users.properties || excluded.properties) as p
    ),
    visit_count = app_users.visit_count + 1,
    last_seen   = now();
end;
$$;
