create schema if not exists private;

-- statement-breakpoint
revoke all on schema private from public, anon, authenticated;

-- statement-breakpoint
create table if not exists private.app_secrets (
  name text primary key,
  secret_value text not null,
  updated_at timestamptz not null default now()
);

-- statement-breakpoint
revoke all on private.app_secrets from public, anon, authenticated;

-- statement-breakpoint
create or replace function public.auto_approve_company_access(
  p_role text,
  p_agent_id uuid,
  p_email text,
  p_secret text
)
returns text
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_user_id text := auth.jwt()->>'sub';
  access_request public.access_requests%rowtype;
begin
  if current_user_id is null or current_user_id = '' then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from private.app_secrets
    where name = 'company_domain_auto_approval'
      and secret_value = p_secret
  ) then
    raise exception 'Automatic approval is not authorized' using errcode = '42501';
  end if;

  if lower(split_part(btrim(p_email), '@', 2)) <> 'linpanrealty.com' then
    raise exception 'Only verified linpanrealty.com accounts can be approved automatically' using errcode = '42501';
  end if;

  if p_role not in ('agent', 'operator') then
    raise exception 'Unsupported access role';
  end if;

  select *
  into access_request
  from public.access_requests
  where clerk_user_id = current_user_id
  for update;

  if not found then
    raise exception 'Access request not found';
  end if;

  if lower(coalesce(access_request.email, '')) <> lower(btrim(p_email)) then
    raise exception 'Verified email does not match the access request' using errcode = '42501';
  end if;

  if access_request.requested_role <> p_role
     or access_request.requested_agent_id is distinct from p_agent_id then
    raise exception 'Approval details do not match the access request' using errcode = '42501';
  end if;

  if p_role = 'agent' then
    if p_agent_id is null then
      raise exception 'An agent profile is required';
    end if;

    update public.agents
    set clerk_user_id = current_user_id
    where id = p_agent_id
      and active = true;

    if not found then
      raise exception 'Active agent profile not found';
    end if;
  end if;

  update public.access_requests
  set status = 'approved',
      approved_role = p_role,
      reviewed_by = 'auto:linpanrealty.com',
      reviewed_at = now(),
      updated_at = now()
  where clerk_user_id = current_user_id;

  insert into public.panel_user_roles (clerk_user_id, role, created_at, updated_at)
  values (current_user_id, p_role, now(), now())
  on conflict (clerk_user_id) do update
  set role = excluded.role,
      updated_at = now();

  return p_role;
end;
$$;

-- statement-breakpoint
revoke execute on function public.auto_approve_company_access(text, uuid, text, text) from public, anon;
-- statement-breakpoint
grant execute on function public.auto_approve_company_access(text, uuid, text, text) to authenticated;
