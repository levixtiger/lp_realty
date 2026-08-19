create table public.open_houses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  date_line text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  contact_name text,
  contact_phone text,
  website_url text,
  notes text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.open_house_items (
  id uuid primary key default gen_random_uuid(),
  open_house_id uuid not null references public.open_houses(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  sort_order integer not null default 0,
  title text not null,
  address_line_1 text not null,
  city text not null,
  state text not null default 'NY',
  postal_code text not null,
  price numeric(14,2) check (price is null or price >= 0),
  bedrooms text,
  bathrooms text,
  property_type text,
  image_url text,
  price_label text not null default 'Offered at',
  event_day_label text not null default 'SUN',
  time_label text not null default '1-3',
  appointment_only boolean not null default false,
  badge text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index open_houses_status_updated_idx on public.open_houses (status, updated_at desc) where deleted_at is null;
create index open_house_items_event_order_idx on public.open_house_items (open_house_id, sort_order);
create index open_house_items_listing_idx on public.open_house_items (listing_id);

create function public.touch_open_house_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.touch_open_house_item_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger open_houses_touch_updated_at
before update on public.open_houses
for each row execute function public.touch_open_house_updated_at();

create trigger open_house_items_touch_updated_at
before update on public.open_house_items
for each row execute function public.touch_open_house_item_updated_at();

revoke execute on function public.touch_open_house_updated_at() from public, anon, authenticated;
revoke execute on function public.touch_open_house_item_updated_at() from public, anon, authenticated;

alter table public.open_houses enable row level security;
alter table public.open_house_items enable row level security;

create policy "employees_manage_open_houses" on public.open_houses
for all to authenticated using (true) with check (true);

create policy "employees_manage_open_house_items" on public.open_house_items
for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.open_houses, public.open_house_items to authenticated;
