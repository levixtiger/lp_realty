create table if not exists public.content_video_links (
  id uuid primary key default gen_random_uuid(),
  content_video_id uuid not null references public.content_videos(id) on delete cascade,
  platform text not null check (platform in ('youtube','instagram','tiktok','facebook','xiaohongshu','wechat','website','other')),
  platform_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_videos
alter column platform set default 'other',
alter column platform_url set default '';

insert into public.content_video_links (content_video_id, platform, platform_url, sort_order)
select id, platform, platform_url, 0
from public.content_videos
where platform_url is not null
  and platform_url <> ''
  and not exists (
    select 1
    from public.content_video_links
    where content_video_links.content_video_id = content_videos.id
  );

create index if not exists content_video_links_video_order_idx on public.content_video_links (content_video_id, sort_order);
create index if not exists content_video_links_platform_idx on public.content_video_links (platform);

create function public.touch_content_video_link_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists content_video_links_touch_updated_at on public.content_video_links;
create trigger content_video_links_touch_updated_at
before update on public.content_video_links
for each row execute function public.touch_content_video_link_updated_at();

revoke execute on function public.touch_content_video_link_updated_at() from public, anon, authenticated;

alter table public.content_video_links enable row level security;

drop policy if exists "employees_manage_content_video_links" on public.content_video_links;
create policy "employees_manage_content_video_links" on public.content_video_links
for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.content_video_links to authenticated;
