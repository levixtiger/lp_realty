alter table public.accounting_allocations
  add column if not exists check_number text,
  add column if not exists check_image_name text,
  add column if not exists check_image_url text;
