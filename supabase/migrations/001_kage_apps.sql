-- Kage Apps user data schema for Supabase (Postgres + Auth).
-- Run in Supabase Dashboard -> SQL Editor. Public app listings stay in root database.js.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(trim(username)) between 1 and 40),
  email text not null,
  avatar_url text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null check (char_length(app_id) between 1 and 160),
  app_name text not null check (char_length(app_name) between 1 and 200),
  downloaded_at timestamptz not null default now()
);

create index if not exists app_downloads_user_date_idx
  on public.app_downloads (user_id, downloaded_at desc);
create index if not exists app_downloads_app_id_idx
  on public.app_downloads (app_id);
create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc);

-- Admin access is controlled by Supabase, never by a browser-side flag.
-- Add the existing Supabase project-owner email here as well if it differs
-- from the requested secondary administrator below.
create table if not exists public.admin_email_allowlist (
  email text primary key check (email = lower(trim(email)))
);
insert into public.admin_email_allowlist (email)
values ('inexbro0002@gmail.com')
on conflict (email) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Only the trusted auth.users trigger can assign the initial user role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := trim(coalesce(new.raw_user_meta_data ->> 'username', ''));
  if char_length(requested_name) < 1 or char_length(requested_name) > 40 then
    requested_name := left(split_part(coalesce(new.email, 'user'), '@', 1), 40);
    if requested_name = '' then requested_name := 'User'; end if;
  end if;
  insert into public.profiles (id, username, email, role, created_at)
  values (
    new.id,
    requested_name,
    coalesce(new.email, ''),
    case when exists (
      select 1 from public.admin_email_allowlist a
      where a.email = lower(trim(coalesce(new.email, '')))
    ) then 'admin' else 'user' end,
    coalesce(new.created_at, now())
  )
  on conflict (id) do update
    set email = excluded.email,
        role = case when exists (
          select 1 from public.admin_email_allowlist a
          where a.email = lower(trim(excluded.email))
        ) then 'admin' else public.profiles.role end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- SECURITY DEFINER avoids recursive profile RLS checks. Only this database-owned
-- function decides the role; client-side flags are never trusted.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1 from public.profiles p
    join public.admin_email_allowlist a on a.email = lower(trim(p.email))
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.app_downloads enable row level security;

-- Expose only authenticated reads that satisfy the owner/admin policy.
revoke all on public.profiles from anon, authenticated;
revoke all on public.app_downloads from anon, authenticated;
revoke all on public.admin_email_allowlist from public, anon, authenticated;
grant select on public.profiles to authenticated;
-- Role and email cannot be modified by browser clients.
grant update (username, avatar_url) on public.profiles to authenticated;
grant select on public.app_downloads to authenticated;
grant insert (user_id, app_id, app_name) on public.app_downloads to authenticated;

drop policy if exists "profile owner or admin can read" on public.profiles;
create policy "profile owner or admin can read"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists "users update their editable profile fields" on public.profiles;
create policy "users update their editable profile fields"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "users and admins read permitted download history" on public.app_downloads;
create policy "users and admins read permitted download history"
on public.app_downloads for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "users insert only their own download history" on public.app_downloads;
create policy "users insert only their own download history"
on public.app_downloads for insert to authenticated
with check ((select auth.uid()) = user_id);

-- To authorize the existing Supabase account, run this once in SQL Editor
-- with that account's exact email, then keep the email in the allowlist:
-- insert into public.admin_email_allowlist (email)
-- values (lower(trim('your-supabase-account@example.com')))
-- on conflict (email) do nothing;
-- update public.profiles set role='admin'
-- where lower(trim(email)) = lower(trim('your-supabase-account@example.com'));
-- Do this only from the Supabase SQL Editor as the project owner.


-- Admin-only directory with database-computed all-time counts and last activity.
create or replace function public.admin_user_activity()
returns table (
  id uuid,
  username text,
  email text,
  created_at timestamptz,
  download_count bigint,
  last_activity timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  return query
    select p.id, p.username, p.email, p.created_at,
           count(d.id)::bigint, max(d.downloaded_at)
    from public.profiles p
    left join public.app_downloads d on d.user_id = p.id
    group by p.id, p.username, p.email, p.created_at
    order by p.created_at desc;
end;
$$;
revoke all on function public.admin_user_activity() from public, anon;
grant execute on function public.admin_user_activity() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

commit;
