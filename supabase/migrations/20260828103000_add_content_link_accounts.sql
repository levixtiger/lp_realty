alter table public.content_video_links
add column if not exists account text;

create index if not exists content_video_links_platform_account_idx
on public.content_video_links (platform, account)
where account is not null;
