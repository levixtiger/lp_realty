drop policy if exists "company_forms_insert_staff" on public.company_forms;
create policy "company_forms_insert_staff" on public.company_forms
for insert to authenticated
with check (
  public.current_panel_role() = 'manager'
  and created_by = auth.jwt()->>'sub'
  and updated_by = auth.jwt()->>'sub'
);

drop policy if exists "company_forms_update_staff" on public.company_forms;
create policy "company_forms_update_staff" on public.company_forms
for update to authenticated
using (public.current_panel_role() = 'manager')
with check (
  public.current_panel_role() = 'manager'
  and updated_by = auth.jwt()->>'sub'
);

drop policy if exists "company_forms_delete_staff" on public.company_forms;
create policy "company_forms_delete_staff" on public.company_forms
for delete to authenticated
using (public.current_panel_role() = 'manager');

drop policy if exists "company_forms_storage_insert_staff" on storage.objects;
create policy "company_forms_storage_insert_staff" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'company-forms'
  and public.current_panel_role() = 'manager'
);

drop policy if exists "company_forms_storage_update_staff" on storage.objects;
create policy "company_forms_storage_update_staff" on storage.objects
for update to authenticated
using (
  bucket_id = 'company-forms'
  and public.current_panel_role() = 'manager'
)
with check (
  bucket_id = 'company-forms'
  and public.current_panel_role() = 'manager'
);

drop policy if exists "company_forms_storage_delete_staff" on storage.objects;
create policy "company_forms_storage_delete_staff" on storage.objects
for delete to authenticated
using (
  bucket_id = 'company-forms'
  and public.current_panel_role() = 'manager'
);
