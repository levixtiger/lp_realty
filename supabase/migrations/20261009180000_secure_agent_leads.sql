update public.leads
set source = case
  when source is null or btrim(source) = '' then 'other'
  when lower(replace(replace(btrim(source), '-', '_'), ' ', '_')) in ('call', 'phone', 'phone_call', 'call_in') then 'call_in'
  when lower(replace(replace(btrim(source), '-', '_'), ' ', '_')) = 'walk_in' then 'walk_in'
  when lower(replace(replace(btrim(source), '-', '_'), ' ', '_')) = 'open_house' then 'open_house'
  when lower(btrim(source)) = 'referral' then 'referral'
  when lower(btrim(source)) in ('website', 'web') then 'website'
  else 'other'
end;

alter table public.leads
  drop constraint if exists leads_source_check;

alter table public.leads
  alter column source set default 'other',
  alter column source set not null,
  add constraint leads_source_check
    check (source in ('call_in', 'walk_in', 'open_house', 'referral', 'website', 'other'));

create or replace function public.current_agent_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.agents
  where clerk_user_id = auth.jwt()->>'sub'
    and active = true
  limit 1;
$$;

create or replace function public.can_access_lead(target_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_panel_role() in ('manager', 'operator')
    or exists (
      select 1
      from public.leads
      where id = target_lead_id
        and assigned_agent_id = public.current_agent_id()
    );
$$;

revoke execute on function public.current_agent_id() from public, anon;
revoke execute on function public.can_access_lead(uuid) from public, anon;
grant execute on function public.current_agent_id() to authenticated;
grant execute on function public.can_access_lead(uuid) to authenticated;

drop policy if exists "employees_manage_leads" on public.leads;
drop policy if exists "leads_select_by_role" on public.leads;
drop policy if exists "leads_insert_by_role" on public.leads;
drop policy if exists "leads_update_by_role" on public.leads;
drop policy if exists "leads_delete_by_role" on public.leads;

create policy "leads_select_by_role" on public.leads
for select to authenticated
using (
  public.current_panel_role() in ('manager', 'operator')
  or assigned_agent_id = public.current_agent_id()
);

create policy "leads_insert_by_role" on public.leads
for insert to authenticated
with check (
  created_by = auth.jwt()->>'sub'
  and updated_by = auth.jwt()->>'sub'
  and (
    public.current_panel_role() in ('manager', 'operator')
    or (public.current_panel_role() = 'agent' and assigned_agent_id = public.current_agent_id())
  )
);

create policy "leads_update_by_role" on public.leads
for update to authenticated
using (
  public.current_panel_role() in ('manager', 'operator')
  or (public.current_panel_role() = 'agent' and assigned_agent_id = public.current_agent_id())
)
with check (
  updated_by = auth.jwt()->>'sub'
  and (
    public.current_panel_role() in ('manager', 'operator')
    or (public.current_panel_role() = 'agent' and assigned_agent_id = public.current_agent_id())
  )
);

create policy "leads_delete_by_role" on public.leads
for delete to authenticated
using (
  public.current_panel_role() in ('manager', 'operator')
  or (public.current_panel_role() = 'agent' and assigned_agent_id = public.current_agent_id())
);

drop policy if exists "employees_manage_lead_interactions" on public.lead_interactions;
drop policy if exists "lead_interactions_select_by_lead" on public.lead_interactions;
drop policy if exists "lead_interactions_insert_by_lead" on public.lead_interactions;
drop policy if exists "lead_interactions_update_by_lead" on public.lead_interactions;
drop policy if exists "lead_interactions_delete_by_lead" on public.lead_interactions;

create policy "lead_interactions_select_by_lead" on public.lead_interactions
for select to authenticated
using (public.can_access_lead(lead_id));

create policy "lead_interactions_insert_by_lead" on public.lead_interactions
for insert to authenticated
with check (
  public.can_access_lead(lead_id)
  and actor_clerk_user_id = auth.jwt()->>'sub'
);

create policy "lead_interactions_update_by_lead" on public.lead_interactions
for update to authenticated
using (public.can_access_lead(lead_id))
with check (public.can_access_lead(lead_id));

create policy "lead_interactions_delete_by_lead" on public.lead_interactions
for delete to authenticated
using (public.can_access_lead(lead_id));
