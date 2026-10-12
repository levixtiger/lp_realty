alter table public.content_video_links
alter column platform_url drop not null;

alter table public.content_video_links
drop constraint if exists content_video_links_wechat_identity_check;

alter table public.content_video_links
add constraint content_video_links_wechat_identity_check
check (
  (platform = 'wechat' and nullif(btrim(coalesce(account, '')), '') is not null)
  or
  (platform <> 'wechat' and nullif(btrim(coalesce(platform_url, '')), '') is not null)
);
