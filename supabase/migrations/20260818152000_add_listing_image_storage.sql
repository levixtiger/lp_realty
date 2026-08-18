insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'listing_images_employee_select') then
    create policy "listing_images_employee_select" on storage.objects for select to authenticated using (bucket_id = 'listing-images');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'listing_images_employee_insert') then
    create policy "listing_images_employee_insert" on storage.objects for insert to authenticated with check (bucket_id = 'listing-images');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'listing_images_employee_update') then
    create policy "listing_images_employee_update" on storage.objects for update to authenticated using (bucket_id = 'listing-images') with check (bucket_id = 'listing-images');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'listing_images_employee_delete') then
    create policy "listing_images_employee_delete" on storage.objects for delete to authenticated using (bucket_id = 'listing-images');
  end if;
end
$$;
