create extension if not exists pgcrypto;

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  full_name text not null,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state text not null default 'NY',
  postal_code text not null,
  property_type text not null,
  asking_price numeric(14,2) not null check (asking_price >= 0),
  building_area_sqft integer check (building_area_sqft is null or building_area_sqft >= 0),
  heating text,
  annual_tax numeric(12,2) check (annual_tax is null or annual_tax >= 0),
  common_charge numeric(12,2) check (common_charge is null or common_charge >= 0),
  description text,
  open_house text,
  status text not null default 'draft' check (status in ('draft','coming_soon','active','under_contract','sold','off_market')),
  assigned_agent_id uuid references public.agents(id) on delete set null,
  sold_by_agent_id uuid references public.agents(id) on delete set null,
  sold_at date,
  image_urls text[] not null default '{}',
  source_url text,
  published boolean not null default false,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sold_listing_requires_agent check (status <> 'sold' or (sold_by_agent_id is not null and sold_at is not null))
);

create index listings_status_idx on public.listings(status) where deleted_at is null;
create index listings_agent_idx on public.listings(assigned_agent_id) where deleted_at is null;
create index listings_sold_by_idx on public.listings(sold_by_agent_id) where status = 'sold';

create table public.listing_activity (
  id bigint generated always as identity primary key,
  listing_id uuid not null,
  action text not null check (action in ('created','updated','status_changed','deleted')),
  from_status text,
  to_status text,
  actor_clerk_user_id text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create function public.audit_listing_change() returns trigger language plpgsql security definer set search_path = public as $$
declare activity_action text; actor_id text;
begin
  actor_id := coalesce(auth.jwt()->>'sub', case when tg_op = 'DELETE' then old.updated_by else new.updated_by end, 'system');
  if tg_op = 'INSERT' then
    insert into public.listing_activity (listing_id, action, to_status, actor_clerk_user_id, after_data)
    values (new.id, 'created', new.status, actor_id, to_jsonb(new)); return new;
  elsif tg_op = 'DELETE' then
    insert into public.listing_activity (listing_id, action, from_status, actor_clerk_user_id, before_data)
    values (old.id, 'deleted', old.status, actor_id, to_jsonb(old)); return old;
  else
    if old.deleted_at is null and new.deleted_at is not null then activity_action := 'deleted';
    elsif old.status is distinct from new.status then activity_action := 'status_changed';
    else activity_action := 'updated'; end if;
    new.updated_at := now();
    insert into public.listing_activity (listing_id, action, from_status, to_status, actor_clerk_user_id, before_data, after_data)
    values (new.id, activity_action, old.status, new.status, actor_id, to_jsonb(old), to_jsonb(new)); return new;
  end if;
end;
$$;

create trigger listings_audit_trigger before insert or update or delete on public.listings for each row execute function public.audit_listing_change();
revoke execute on function public.audit_listing_change() from public, anon, authenticated;

alter table public.agents enable row level security;
alter table public.listings enable row level security;
alter table public.listing_activity enable row level security;
create policy "employees_manage_agents" on public.agents for all to authenticated using (true) with check (true);
create policy "employees_manage_listings" on public.listings for all to authenticated using (true) with check (true);
create policy "employees_read_listing_activity" on public.listing_activity for select to authenticated using (true);
grant select, insert, update, delete on public.agents, public.listings to authenticated;
grant select on public.listing_activity to authenticated;
