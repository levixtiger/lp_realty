create table public.content_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  platform text not null check (platform in ('youtube','instagram','tiktok','facebook','xiaohongshu','wechat','website','other')),
  platform_url text not null,
  status text not null default 'published' check (status in ('idea','editing','scheduled','published','archived')),
  listing_id uuid references public.listings(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  published_at date,
  thumbnail_url text,
  notes text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index content_videos_platform_updated_idx on public.content_videos (platform, updated_at desc) where deleted_at is null;
create index content_videos_status_updated_idx on public.content_videos (status, updated_at desc) where deleted_at is null;
create index content_videos_listing_idx on public.content_videos (listing_id) where deleted_at is null;
create index content_videos_agent_idx on public.content_videos (agent_id) where deleted_at is null;

create function public.touch_content_video_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger content_videos_touch_updated_at
before update on public.content_videos
for each row execute function public.touch_content_video_updated_at();

revoke execute on function public.touch_content_video_updated_at() from public, anon, authenticated;

alter table public.content_videos enable row level security;

create policy "employees_manage_content_videos" on public.content_videos
for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.content_videos to authenticated;
