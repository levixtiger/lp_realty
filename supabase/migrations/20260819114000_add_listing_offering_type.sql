alter table public.listings
add column if not exists offering_type text not null default 'sale'
check (offering_type in ('sale', 'rent', 'lease'));

create index if not exists listings_offering_type_idx
on public.listings (offering_type)
where deleted_at is null;
