alter table public.accounting_closings
  add column if not exists office text not null default 'lin_pan_realty',
  add column if not exists mls_number text,
  add column if not exists reception_date date,
  add column if not exists check_amount numeric(12,2) not null default 0,
  add column if not exists check_number text,
  add column if not exists check_image_name text,
  add column if not exists check_image_url text,
  add column if not exists deal_sheet_name text,
  add column if not exists deal_sheet_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounting_closings_office_check'
      and conrelid = 'public.accounting_closings'::regclass
  ) then
    alter table public.accounting_closings
      add constraint accounting_closings_office_check
      check (office in ('lin_pan_realty', 'lin_pan_international_realty'));
  end if;
end $$;

update public.accounting_closings
set
  reception_date = coalesce(reception_date, closing_date, now()::date),
  check_amount = case
    when check_amount = 0 and gross_commission <> 0 then gross_commission
    else check_amount
  end,
  deal_sheet_name = coalesce(deal_sheet_name, closing_file_name),
  deal_sheet_url = coalesce(deal_sheet_url, closing_file_url)
where
  reception_date is null
  or (check_amount = 0 and gross_commission <> 0)
  or (deal_sheet_name is null and closing_file_name is not null)
  or (deal_sheet_url is null and closing_file_url is not null);

alter table public.accounting_closings
  alter column reception_date set default now()::date,
  alter column reception_date set not null;

create index if not exists accounting_closings_office_reception_idx
  on public.accounting_closings (office, reception_date desc)
  where deleted_at is null;
