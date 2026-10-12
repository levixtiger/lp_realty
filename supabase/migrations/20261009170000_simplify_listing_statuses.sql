alter table public.listings
  drop constraint if exists listings_status_check,
  drop constraint if exists sold_listing_requires_agent;

update public.listings
set status = case status
  when 'under_contract' then 'pending'
  when 'sold' then 'closed'
  when 'draft' then 'off_market'
  when 'coming_soon' then 'off_market'
  else status
end;

alter table public.listings
  alter column status set default 'active',
  add constraint listings_status_check
    check (status in ('active', 'pending', 'closed', 'off_market')),
  add constraint closed_listing_requires_agent
    check (status <> 'closed' or (sold_by_agent_id is not null and sold_at is not null));

drop index if exists public.listings_sold_by_idx;
create index if not exists listings_closed_by_idx
  on public.listings(sold_by_agent_id)
  where status = 'closed';
