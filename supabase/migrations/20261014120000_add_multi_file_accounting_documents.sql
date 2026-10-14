alter table public.accounting_closings
  add column if not exists deal_sheet_files jsonb not null default '[]'::jsonb;

alter table public.accounting_intake_payments
  add column if not exists document_files jsonb not null default '[]'::jsonb;

update public.accounting_closings
set deal_sheet_files = jsonb_build_array(jsonb_build_object('name', coalesce(deal_sheet_name, closing_file_name, 'Deal sheet'), 'url', coalesce(deal_sheet_url, closing_file_url)))
where jsonb_array_length(deal_sheet_files) = 0
  and coalesce(deal_sheet_url, closing_file_url) is not null;

update public.accounting_intake_payments
set document_files = jsonb_build_array(jsonb_build_object('name', coalesce(document_name, 'Payment document'), 'url', document_url))
where jsonb_array_length(document_files) = 0
  and document_url is not null;

alter table public.accounting_closings
  add constraint accounting_closings_deal_sheet_files_array
  check (jsonb_typeof(deal_sheet_files) = 'array') not valid;

alter table public.accounting_intake_payments
  add constraint accounting_intake_document_files_array
  check (jsonb_typeof(document_files) = 'array') not valid;

alter table public.accounting_closings validate constraint accounting_closings_deal_sheet_files_array;
alter table public.accounting_intake_payments validate constraint accounting_intake_document_files_array;
