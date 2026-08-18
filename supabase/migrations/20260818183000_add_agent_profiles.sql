alter table public.agents
  add column title text,
  add column bio text,
  add column photo_url text,
  add column license_number text,
  add column languages text[] not null default '{}',
  add column updated_at timestamptz not null default now();

create index agents_active_name_idx
  on public.agents (lower(full_name))
  where active = true;

grant select, insert, update, delete on public.agents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agent-photos',
  'agent-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "agent_photos_employee_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'agent-photos');

create policy "agent_photos_employee_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'agent-photos');

create policy "agent_photos_employee_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'agent-photos')
  with check (bucket_id = 'agent-photos');

create policy "agent_photos_employee_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'agent-photos');
