create table if not exists public.company_forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'General',
  file_name text not null,
  file_path text not null unique,
  mime_type text,
  file_size bigint,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists company_forms_category_idx
  on public.company_forms (category, title)
  where deleted_at is null;

drop trigger if exists company_forms_touch_updated_at on public.company_forms;
create trigger company_forms_touch_updated_at
before update on public.company_forms
for each row execute function public.touch_updated_at();

alter table public.company_forms enable row level security;

create policy "company_forms_select_approved_users" on public.company_forms
for select to authenticated
using (public.current_panel_role() in ('manager', 'operator', 'agent'));

create policy "company_forms_insert_staff" on public.company_forms
for insert to authenticated
with check (
  public.current_panel_role() in ('manager', 'operator')
  and created_by = auth.jwt()->>'sub'
  and updated_by = auth.jwt()->>'sub'
);

create policy "company_forms_update_staff" on public.company_forms
for update to authenticated
using (public.current_panel_role() in ('manager', 'operator'))
with check (
  public.current_panel_role() in ('manager', 'operator')
  and updated_by = auth.jwt()->>'sub'
);

create policy "company_forms_delete_staff" on public.company_forms
for delete to authenticated
using (public.current_panel_role() in ('manager', 'operator'));

grant select, insert, update, delete on public.company_forms to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-forms',
  'company-forms',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "company_forms_storage_select_approved_users" on storage.objects
for select to authenticated
using (
  bucket_id = 'company-forms'
  and public.current_panel_role() in ('manager', 'operator', 'agent')
);

create policy "company_forms_storage_insert_staff" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'company-forms'
  and public.current_panel_role() in ('manager', 'operator')
);

create policy "company_forms_storage_update_staff" on storage.objects
for update to authenticated
using (
  bucket_id = 'company-forms'
  and public.current_panel_role() in ('manager', 'operator')
)
with check (
  bucket_id = 'company-forms'
  and public.current_panel_role() in ('manager', 'operator')
);

create policy "company_forms_storage_delete_staff" on storage.objects
for delete to authenticated
using (
  bucket_id = 'company-forms'
  and public.current_panel_role() in ('manager', 'operator')
);
