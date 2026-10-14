alter table public.leads
  add column if not exists lead_type text not null default 'buyer';

alter table public.leads
  drop constraint if exists leads_lead_type_check;

alter table public.leads
  add constraint leads_lead_type_check
  check (lead_type in ('buyer', 'seller', 'landlord', 'tenant'));

create table if not exists public.lead_listings (
  lead_id uuid not null references public.leads(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, listing_id)
);

create index if not exists lead_listings_listing_idx
  on public.lead_listings (listing_id, lead_id);

alter table public.lead_listings enable row level security;

drop policy if exists "lead_listings_select_by_lead" on public.lead_listings;
drop policy if exists "lead_listings_insert_by_lead" on public.lead_listings;
drop policy if exists "lead_listings_delete_by_lead" on public.lead_listings;

create policy "lead_listings_select_by_lead" on public.lead_listings
for select to authenticated
using (public.can_access_lead(lead_id));

create policy "lead_listings_insert_by_lead" on public.lead_listings
for insert to authenticated
with check (public.can_access_lead(lead_id));

create policy "lead_listings_delete_by_lead" on public.lead_listings
for delete to authenticated
using (public.can_access_lead(lead_id));

grant select, insert, delete on public.lead_listings to authenticated;
