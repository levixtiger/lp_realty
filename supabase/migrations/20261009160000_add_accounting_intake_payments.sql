create table if not exists public.accounting_intake_payments (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references public.accounting_closings(id) on delete cascade,
  payment_method text not null default 'check' check (payment_method in ('check', 'cash', 'wire', 'other')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  reference_number text,
  document_name text,
  document_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounting_allocations
  add column if not exists payment_method text not null default 'check'
  check (payment_method in ('check', 'cash', 'wire', 'other'));

create index if not exists accounting_intake_payments_closing_order_idx
  on public.accounting_intake_payments (closing_id, sort_order);

drop trigger if exists accounting_intake_payments_touch_updated_at on public.accounting_intake_payments;
create trigger accounting_intake_payments_touch_updated_at
before update on public.accounting_intake_payments
for each row execute function public.touch_updated_at();

alter table public.accounting_intake_payments enable row level security;

drop policy if exists "employees_manage_accounting_intake_payments" on public.accounting_intake_payments;
create policy "employees_manage_accounting_intake_payments" on public.accounting_intake_payments
for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.accounting_intake_payments to authenticated;

insert into public.accounting_intake_payments (
  closing_id,
  payment_method,
  amount,
  reference_number,
  document_name,
  document_url,
  sort_order
)
select
  closing.id,
  'check',
  coalesce(nullif(closing.check_amount, 0), closing.gross_commission, 0),
  closing.check_number,
  closing.check_image_name,
  closing.check_image_url,
  0
from public.accounting_closings as closing
where coalesce(nullif(closing.check_amount, 0), closing.gross_commission, 0) > 0
  and not exists (
    select 1
    from public.accounting_intake_payments as payment
    where payment.closing_id = closing.id
  );
