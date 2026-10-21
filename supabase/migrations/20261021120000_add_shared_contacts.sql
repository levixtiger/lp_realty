create table if not exists public.external_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  expertise text not null default 'Other',
  phone text,
  email text,
  website text,
  address text,
  notes text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint external_contacts_method_check check (
    nullif(btrim(phone), '') is not null
    or nullif(btrim(email), '') is not null
    or nullif(btrim(website), '') is not null
  )
);

create index if not exists external_contacts_expertise_name_idx
  on public.external_contacts (expertise, name)
  where deleted_at is null;

drop trigger if exists external_contacts_touch_updated_at on public.external_contacts;
create trigger external_contacts_touch_updated_at
before update on public.external_contacts
for each row execute function public.touch_updated_at();

alter table public.external_contacts enable row level security;

create policy "external_contacts_select_approved" on public.external_contacts
for select to authenticated
using (public.current_panel_role() in ('manager', 'operator', 'agent'));

create policy "external_contacts_insert_approved" on public.external_contacts
for insert to authenticated
with check (
  public.current_panel_role() in ('manager', 'operator', 'agent')
  and created_by = auth.jwt()->>'sub'
  and updated_by = auth.jwt()->>'sub'
);

create policy "external_contacts_update_owner_or_staff" on public.external_contacts
for update to authenticated
using (
  public.current_panel_role() in ('manager', 'operator')
  or (public.current_panel_role() = 'agent' and created_by = auth.jwt()->>'sub')
)
with check (
  updated_by = auth.jwt()->>'sub'
  and (
    public.current_panel_role() in ('manager', 'operator')
    or (public.current_panel_role() = 'agent' and created_by = auth.jwt()->>'sub')
  )
);

create policy "external_contacts_delete_owner_or_staff" on public.external_contacts
for delete to authenticated
using (
  public.current_panel_role() in ('manager', 'operator')
  or (public.current_panel_role() = 'agent' and created_by = auth.jwt()->>'sub')
);

grant select, insert, update, delete on public.external_contacts to authenticated;
