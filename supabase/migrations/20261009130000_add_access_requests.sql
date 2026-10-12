create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text,
  full_name text not null,
  phone text not null,
  requested_role text not null check (requested_role in ('agent','operator')),
  requested_agent_id uuid references public.agents(id) on delete set null,
  requested_agent_name text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_role text check (approved_role is null or approved_role in ('agent','operator')),
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists access_requests_status_created_idx on public.access_requests (status, created_at desc);
create index if not exists access_requests_requested_agent_idx on public.access_requests (requested_agent_id) where requested_agent_id is not null;

create or replace function public.touch_access_requests_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists access_requests_touch_updated_at on public.access_requests;
create trigger access_requests_touch_updated_at before update on public.access_requests for each row execute function public.touch_access_requests_updated_at();
revoke execute on function public.touch_access_requests_updated_at() from public, anon, authenticated;

alter table public.access_requests enable row level security;

create table if not exists public.panel_user_roles (
  clerk_user_id text primary key,
  role text not null check (role in ('manager','operator','agent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.panel_user_roles enable row level security;
revoke all on public.panel_user_roles from public, anon, authenticated;

create or replace function public.current_panel_role()
returns text language sql stable security definer set search_path = public as $$
  select lower(coalesce(
    (select role from public.panel_user_roles where clerk_user_id = auth.jwt()->>'sub' limit 1),
    auth.jwt()->>'accountingRole',
    auth.jwt()->'publicMetadata'->>'accountingRole',
    auth.jwt()->'publicMetadata'->>'role',
    auth.jwt()->'public_metadata'->>'accountingRole',
    auth.jwt()->'public_metadata'->>'role',
    auth.jwt()->'unsafeMetadata'->>'accountingRole',
    auth.jwt()->'unsafeMetadata'->>'role',
    auth.jwt()->'unsafe_metadata'->>'accountingRole',
    auth.jwt()->'unsafe_metadata'->>'role',
    auth.jwt()->'user_metadata'->>'accountingRole',
    auth.jwt()->'user_metadata'->>'role',
    auth.jwt()->'app_metadata'->>'accountingRole',
    auth.jwt()->'app_metadata'->>'role',
    auth.jwt()->'metadata'->>'accountingRole',
    auth.jwt()->'metadata'->>'role',
    case
      when lower(auth.jwt()->>'role') in ('manager', 'operator', 'agent') then auth.jwt()->>'role'
      else null
    end,
    ''
  ));
$$;
revoke execute on function public.current_panel_role() from public, anon;
grant execute on function public.current_panel_role() to authenticated;

drop policy if exists "access_requests_select_own_or_manager" on public.access_requests;
drop policy if exists "access_requests_insert_own_pending" on public.access_requests;
drop policy if exists "access_requests_update_own_pending_or_manager" on public.access_requests;
drop policy if exists "access_requests_delete_manager" on public.access_requests;

create policy "access_requests_select_own_or_manager" on public.access_requests
for select to authenticated
using (clerk_user_id = auth.jwt()->>'sub' or public.current_panel_role() = 'manager');

create policy "access_requests_insert_own_pending" on public.access_requests
for insert to authenticated
with check (clerk_user_id = auth.jwt()->>'sub' and status = 'pending' and approved_role is null);

create policy "access_requests_update_own_pending_or_manager" on public.access_requests
for update to authenticated
using ((clerk_user_id = auth.jwt()->>'sub' and status <> 'approved') or public.current_panel_role() = 'manager')
with check ((clerk_user_id = auth.jwt()->>'sub' and status = 'pending' and approved_role is null) or public.current_panel_role() = 'manager');

create policy "access_requests_delete_manager" on public.access_requests
for delete to authenticated
using (public.current_panel_role() = 'manager');

grant select, insert, update, delete on public.access_requests to authenticated;

create or replace function public.get_access_requests()
returns setof public.access_requests
language sql
stable
security definer
set search_path = public
as $$
  select request.*
  from public.access_requests as request
  where request.clerk_user_id = auth.jwt()->>'sub'
     or public.current_panel_role() = 'manager'
  order by request.created_at desc;
$$;

revoke execute on function public.get_access_requests() from public, anon;
grant execute on function public.get_access_requests() to authenticated;
