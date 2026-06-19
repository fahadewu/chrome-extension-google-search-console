-- Multi-app analytics backend.
-- One Supabase project can back many extensions/products: each is a row in
-- `apps`, its users live in `app_users` (scoped by app_id), and `events` is a
-- generic log for anything else you want to track.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- apps: register each product that reports here.
-- ---------------------------------------------------------------------------
create table if not exists public.apps (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,         -- e.g. 'search-console-peek'
  name        text not null,
  ingest_key  text not null,                -- per-app key the client must send
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- app_users: a person, per app. Common columns + flexible metadata.
-- ---------------------------------------------------------------------------
create table if not exists public.app_users (
  id           uuid primary key default gen_random_uuid(),
  app_id       uuid not null references public.apps(id) on delete cascade,
  external_id  text not null,               -- stable id from the app (e.g. Google sub)
  email        text,
  name         text,
  avatar_url   text,
  metadata     jsonb not null default '{}', -- app-specific (this app: { properties: [...] })
  visit_count  integer not null default 0,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  unique (app_id, external_id)
);
create index if not exists app_users_app_last_seen_idx
  on public.app_users (app_id, last_seen desc);

-- ---------------------------------------------------------------------------
-- events: generic per-app event log for future needs.
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id         bigint generated always as identity primary key,
  app_id     uuid not null references public.apps(id) on delete cascade,
  user_id    uuid references public.app_users(id) on delete set null,
  type       text not null,
  data       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists events_app_created_idx
  on public.events (app_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Lock everything down: only the service role (used by edge functions) gets in.
-- The public anon key can never read or write these tables directly.
-- ---------------------------------------------------------------------------
alter table public.apps      enable row level security;
alter table public.app_users enable row level security;
alter table public.events    enable row level security;

-- ---------------------------------------------------------------------------
-- record_user: upsert a user for an app.
-- Metadata merge convention (reusable across apps):
--   * array values are UNIONed with what's already stored (e.g. properties)
--   * all other values overwrite
-- Returns the user's id.
-- ---------------------------------------------------------------------------
create or replace function public.record_user(
  p_app_slug    text,
  p_external_id text,
  p_email       text,
  p_name        text,
  p_avatar      text,
  p_metadata    jsonb default '{}'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_id   uuid;
  v_user_id  uuid;
  v_existing jsonb;
  v_merged   jsonb;
  k          text;
  v          jsonb;
begin
  select id into v_app_id from public.apps where slug = p_app_slug;
  if v_app_id is null then
    raise exception 'unknown app slug: %', p_app_slug;
  end if;

  select metadata into v_existing
    from public.app_users
    where app_id = v_app_id and external_id = p_external_id;
  v_merged := coalesce(v_existing, '{}'::jsonb);

  for k, v in select * from jsonb_each(coalesce(p_metadata, '{}'::jsonb)) loop
    if jsonb_typeof(v) = 'array' and jsonb_typeof(v_merged -> k) = 'array' then
      -- union the two arrays, drop duplicates
      v_merged := jsonb_set(v_merged, array[k], (
        select coalesce(jsonb_agg(distinct e), '[]'::jsonb)
        from (
          select jsonb_array_elements(v_merged -> k) as e
          union
          select jsonb_array_elements(v) as e
        ) u
      ));
    else
      v_merged := jsonb_set(v_merged, array[k], v, true);
    end if;
  end loop;

  insert into public.app_users
    (app_id, external_id, email, name, avatar_url, metadata, visit_count, first_seen, last_seen)
  values
    (v_app_id, p_external_id, p_email, p_name, p_avatar, v_merged, 1, now(), now())
  on conflict (app_id, external_id) do update set
    email       = coalesce(excluded.email, app_users.email),
    name        = coalesce(excluded.name, app_users.name),
    avatar_url  = coalesce(excluded.avatar_url, app_users.avatar_url),
    metadata    = v_merged,
    visit_count = app_users.visit_count + 1,
    last_seen   = now()
  returning id into v_user_id;

  return v_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- log_event: generic event logger (optional; for future use).
-- ---------------------------------------------------------------------------
create or replace function public.log_event(
  p_app_slug text,
  p_user_id  uuid,
  p_type     text,
  p_data     jsonb default '{}'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app_id uuid;
begin
  select id into v_app_id from public.apps where slug = p_app_slug;
  if v_app_id is null then
    raise exception 'unknown app slug: %', p_app_slug;
  end if;
  insert into public.events (app_id, user_id, type, data)
  values (v_app_id, p_user_id, p_type, coalesce(p_data, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Register this extension. Replace the ingest key with a long random string
-- (e.g. `openssl rand -hex 24`) and use the SAME value in src/lib/config.js.
-- To add a future product later, just insert another row here.
-- ---------------------------------------------------------------------------
insert into public.apps (slug, name, ingest_key)
values ('search-console-peek', 'Search Console Peek', 'REPLACE_WITH_INGEST_KEY')
on conflict (slug) do nothing;
