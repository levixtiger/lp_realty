create table if not exists public.accounting_closings (
  id uuid primary key default gen_random_uuid(),
  office text not null default 'lin_pan_realty' check (office in ('lin_pan_realty', 'lin_pan_international_realty')),
  property_address text not null,
  mls_number text,
  reception_date date not null default now()::date,
  check_amount numeric(12,2) not null default 0,
  check_number text,
  check_image_name text,
  check_image_url text,
  deal_sheet_name text,
  deal_sheet_url text,
  closing_date date not null,
  buyer text,
  seller text,
  transaction_type text not null default 'sale' check (transaction_type in ('sale', 'rent', 'lease', 'referral', 'other')),
  gross_commission numeric(12,2) not null default 0,
  company_commission_income numeric(12,2) not null default 0,
  closing_file_name text,
  closing_file_url text,
  notes text,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'paid')),
  approval_date date,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.accounting_allocations (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references public.accounting_closings(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  agent_name text not null,
  check_number text,
  check_image_name text,
  check_image_url text,
  role text,
  gross_commission numeric(12,2) not null default 0,
  referral_fee numeric(12,2) not null default 0,
  other_deductions numeric(12,2) not null default 0,
  split_percentage numeric(7,2) not null default 0,
  net_to_agent numeric(12,2) not null default 0,
  team_leader_share numeric(12,2) not null default 0,
  company_share numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid')),
  paid_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounting_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  description text,
  agent_percentage numeric(7,2) not null default 0,
  team_percentage numeric(7,2) not null default 0,
  company_percentage numeric(7,2) not null default 0,
  active boolean not null default true,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.accounting_payees (
  id uuid primary key default gen_random_uuid(),
  office text not null default 'lin_pan_realty' check (office in ('lin_pan_realty', 'lin_pan_international_realty')),
  payee text not null,
  agent_id uuid references public.agents(id) on delete set null,
  agent_name text not null,
  tax_id text not null,
  address text not null,
  active boolean not null default true,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.accounting_audit_entries (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references public.accounting_closings(id) on delete cascade,
  actor_clerk_user_id text not null,
  actor_name text,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create index if not exists accounting_closings_status_date_idx on public.accounting_closings (status, closing_date) where deleted_at is null;
create index if not exists accounting_closings_office_reception_idx on public.accounting_closings (office, reception_date desc) where deleted_at is null;
create index if not exists accounting_allocations_closing_order_idx on public.accounting_allocations (closing_id, sort_order);
create index if not exists accounting_allocations_agent_idx on public.accounting_allocations (agent_id, payment_status);
create index if not exists accounting_rules_active_idx on public.accounting_rules (active, rule_name) where deleted_at is null;
create unique index if not exists accounting_payees_office_agent_unique_idx on public.accounting_payees (office, agent_id) where deleted_at is null and agent_id is not null;
create index if not exists accounting_payees_office_agent_name_idx on public.accounting_payees (office, agent_name) where deleted_at is null;
create index if not exists accounting_audit_closing_created_idx on public.accounting_audit_entries (closing_id, created_at desc);

drop trigger if exists accounting_closings_touch_updated_at on public.accounting_closings;
create trigger accounting_closings_touch_updated_at
before update on public.accounting_closings
for each row execute function public.touch_updated_at();

drop trigger if exists accounting_allocations_touch_updated_at on public.accounting_allocations;
create trigger accounting_allocations_touch_updated_at
before update on public.accounting_allocations
for each row execute function public.touch_updated_at();

drop trigger if exists accounting_rules_touch_updated_at on public.accounting_rules;
create trigger accounting_rules_touch_updated_at
before update on public.accounting_rules
for each row execute function public.touch_updated_at();

drop trigger if exists accounting_payees_touch_updated_at on public.accounting_payees;
create trigger accounting_payees_touch_updated_at
before update on public.accounting_payees
for each row execute function public.touch_updated_at();

alter table public.accounting_closings enable row level security;
alter table public.accounting_allocations enable row level security;
alter table public.accounting_rules enable row level security;
alter table public.accounting_payees enable row level security;
alter table public.accounting_audit_entries enable row level security;

drop policy if exists "employees_manage_accounting_closings" on public.accounting_closings;
create policy "employees_manage_accounting_closings" on public.accounting_closings
for all to authenticated using (true) with check (true);

drop policy if exists "employees_manage_accounting_allocations" on public.accounting_allocations;
create policy "employees_manage_accounting_allocations" on public.accounting_allocations
for all to authenticated using (true) with check (true);

drop policy if exists "employees_manage_accounting_rules" on public.accounting_rules;
create policy "employees_manage_accounting_rules" on public.accounting_rules
for all to authenticated using (true) with check (true);

drop policy if exists "employees_manage_accounting_payees" on public.accounting_payees;
create policy "employees_manage_accounting_payees" on public.accounting_payees
for all to authenticated using (true) with check (true);

drop policy if exists "employees_manage_accounting_audit_entries" on public.accounting_audit_entries;
create policy "employees_manage_accounting_audit_entries" on public.accounting_audit_entries
for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('accounting-documents', 'accounting-documents', false)
on conflict (id) do nothing;

drop policy if exists "accounting_documents_employee_select" on storage.objects;
create policy "accounting_documents_employee_select" on storage.objects
for select to authenticated
using (bucket_id = 'accounting-documents');

drop policy if exists "accounting_documents_employee_insert" on storage.objects;
create policy "accounting_documents_employee_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'accounting-documents');

drop policy if exists "accounting_documents_employee_update" on storage.objects;
create policy "accounting_documents_employee_update" on storage.objects
for update to authenticated
using (bucket_id = 'accounting-documents')
with check (bucket_id = 'accounting-documents');

drop policy if exists "accounting_documents_employee_delete" on storage.objects;
create policy "accounting_documents_employee_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'accounting-documents');

grant select, insert, update, delete on public.accounting_closings to authenticated;
grant select, insert, update, delete on public.accounting_allocations to authenticated;
grant select, insert, update, delete on public.accounting_rules to authenticated;
grant select, insert, update, delete on public.accounting_payees to authenticated;
grant select, insert, update, delete on public.accounting_audit_entries to authenticated;
