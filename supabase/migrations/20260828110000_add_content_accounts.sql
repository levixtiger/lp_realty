create table if not exists public.content_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('youtube', 'instagram', 'tiktok', 'facebook', 'xiaohongshu', 'wechat', 'website', 'other')),
  account_name text not null,
  display_name text,
  default_url text,
  notes text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create unique index if not exists content_accounts_platform_name_unique_idx
on public.content_accounts (lower(platform), lower(account_name))
where deleted_at is null;

create index if not exists content_accounts_platform_sort_idx
on public.content_accounts (platform, sort_order, account_name)
where deleted_at is null;

drop trigger if exists content_accounts_touch_updated_at on public.content_accounts;
create trigger content_accounts_touch_updated_at
before update on public.content_accounts
for each row execute function public.touch_updated_at();

alter table public.content_accounts enable row level security;

drop policy if exists "employees_manage_content_accounts" on public.content_accounts;
create policy "employees_manage_content_accounts" on public.content_accounts
for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.content_accounts to authenticated;
