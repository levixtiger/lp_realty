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

create unique index if not exists accounting_payees_office_agent_unique_idx
on public.accounting_payees (office, agent_id)
where deleted_at is null and agent_id is not null;

create index if not exists accounting_payees_office_agent_name_idx
on public.accounting_payees (office, agent_name)
where deleted_at is null;

drop trigger if exists accounting_payees_touch_updated_at on public.accounting_payees;
create trigger accounting_payees_touch_updated_at
before update on public.accounting_payees
for each row execute function public.touch_updated_at();

alter table public.accounting_payees enable row level security;

drop policy if exists "employees_manage_accounting_payees" on public.accounting_payees;
create policy "employees_manage_accounting_payees" on public.accounting_payees
for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.accounting_payees to authenticated;
