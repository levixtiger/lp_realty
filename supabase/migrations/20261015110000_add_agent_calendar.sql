create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null unique references public.agents(id) on delete cascade,
  feed_token uuid not null unique default gen_random_uuid(),
  provider text not null default 'ical' check (provider in ('ical')),
  timezone text not null default 'America/New_York',
  enabled boolean not null default true,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_type text not null default 'showing' check (event_type in ('showing', 'open_house', 'blocked', 'other')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  assigned_agent_id uuid not null references public.agents(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  open_house_id uuid references public.open_houses(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/New_York',
  location text,
  notes text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint calendar_events_time_order check (ends_at > starts_at)
);

create unique index if not exists calendar_events_open_house_unique
  on public.calendar_events (open_house_id)
  where open_house_id is not null and deleted_at is null;

create index if not exists calendar_events_agent_time_idx
  on public.calendar_events (assigned_agent_id, starts_at, ends_at)
  where deleted_at is null;

alter table public.open_houses
  add column if not exists assigned_agent_id uuid references public.agents(id) on delete set null,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

create index if not exists open_houses_agent_time_idx
  on public.open_houses (assigned_agent_id, starts_at)
  where deleted_at is null;

create or replace function public.touch_calendar_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendar_connections_touch_updated_at on public.calendar_connections;
create trigger calendar_connections_touch_updated_at
before update on public.calendar_connections
for each row execute function public.touch_calendar_updated_at();

drop trigger if exists calendar_events_touch_updated_at on public.calendar_events;
create trigger calendar_events_touch_updated_at
before update on public.calendar_events
for each row execute function public.touch_calendar_updated_at();

create or replace function public.prevent_calendar_overlap()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.deleted_at is null and new.status = 'scheduled' and exists (
    select 1
    from public.calendar_events existing
    where existing.assigned_agent_id = new.assigned_agent_id
      and existing.id <> new.id
      and existing.deleted_at is null
      and existing.status = 'scheduled'
      and tstzrange(existing.starts_at, existing.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'This agent already has an event during that time.' using errcode = '23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_events_prevent_overlap on public.calendar_events;
create trigger calendar_events_prevent_overlap
before insert or update of assigned_agent_id, starts_at, ends_at, status, deleted_at on public.calendar_events
for each row execute function public.prevent_calendar_overlap();

alter table public.calendar_connections enable row level security;
alter table public.calendar_events enable row level security;

create policy "calendar_connections_select_by_role" on public.calendar_connections
for select to authenticated
using (
  public.current_panel_role() in ('manager', 'operator')
  or agent_id = public.current_agent_id()
);

create policy "calendar_connections_insert_own" on public.calendar_connections
for insert to authenticated
with check (
  public.current_panel_role() = 'agent'
  and agent_id = public.current_agent_id()
  and created_by = auth.jwt()->>'sub'
  and updated_by = auth.jwt()->>'sub'
);

create policy "calendar_connections_update_own" on public.calendar_connections
for update to authenticated
using (agent_id = public.current_agent_id())
with check (agent_id = public.current_agent_id() and updated_by = auth.jwt()->>'sub');

create policy "calendar_connections_delete_own" on public.calendar_connections
for delete to authenticated
using (agent_id = public.current_agent_id());

create policy "calendar_events_select_by_role" on public.calendar_events
for select to authenticated
using (
  public.current_panel_role() in ('manager', 'operator')
  or assigned_agent_id = public.current_agent_id()
);

create policy "calendar_events_insert_by_role" on public.calendar_events
for insert to authenticated
with check (
  created_by = auth.jwt()->>'sub'
  and updated_by = auth.jwt()->>'sub'
  and (
    public.current_panel_role() in ('manager', 'operator')
    or (public.current_panel_role() = 'agent' and assigned_agent_id = public.current_agent_id())
  )
);

create policy "calendar_events_update_by_role" on public.calendar_events
for update to authenticated
using (
  public.current_panel_role() in ('manager', 'operator')
  or (public.current_panel_role() = 'agent' and assigned_agent_id = public.current_agent_id())
)
with check (
  updated_by = auth.jwt()->>'sub'
  and (
    public.current_panel_role() in ('manager', 'operator')
    or (public.current_panel_role() = 'agent' and assigned_agent_id = public.current_agent_id())
  )
);

create policy "calendar_events_delete_by_role" on public.calendar_events
for delete to authenticated
using (
  public.current_panel_role() in ('manager', 'operator')
  or (public.current_panel_role() = 'agent' and assigned_agent_id = public.current_agent_id())
);

grant select, insert, update, delete on public.calendar_connections, public.calendar_events to authenticated;

create or replace function public.get_calendar_feed(calendar_token uuid)
returns table (
  id uuid,
  title text,
  event_type text,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  location text,
  notes text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select event.id, event.title, event.event_type, event.status, event.starts_at, event.ends_at,
    event.timezone, event.location, event.notes, event.updated_at
  from public.calendar_connections connection
  join public.calendar_events event on event.assigned_agent_id = connection.agent_id
  where connection.feed_token = calendar_token
    and connection.enabled = true
    and event.deleted_at is null
    and event.status <> 'cancelled'
    and event.ends_at >= now() - interval '90 days'
    and event.starts_at <= now() + interval '2 years'
  order by event.starts_at;
$$;

revoke execute on function public.touch_calendar_updated_at() from public, anon, authenticated;
revoke execute on function public.prevent_calendar_overlap() from public, anon, authenticated;
revoke execute on function public.get_calendar_feed(uuid) from public;
grant execute on function public.get_calendar_feed(uuid) to anon, authenticated;
