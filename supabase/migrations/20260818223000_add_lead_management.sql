create table public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null default '',
  email text,
  phone text,
  source text,
  status text not null default 'new' check (status in ('new','contacted','qualified','nurturing','converted','lost')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  assigned_agent_id uuid references public.agents(id) on delete set null,
  budget_min numeric(14,2) check (budget_min is null or budget_min >= 0),
  budget_max numeric(14,2) check (budget_max is null or budget_max >= 0),
  preferred_areas text[] not null default '{}',
  property_interest text,
  notes text,
  next_follow_up_at timestamptz,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint leads_budget_range check (budget_min is null or budget_max is null or budget_max >= budget_min)
);

create table public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('call','email','text','meeting','note')),
  direction text not null default 'outbound' check (direction in ('inbound','outbound','internal')),
  subject text,
  notes text not null,
  happened_at timestamptz not null default now(),
  actor_clerk_user_id text not null,
  actor_name text,
  created_at timestamptz not null default now()
);

create index leads_status_updated_idx on public.leads (status, updated_at desc) where deleted_at is null;
create index leads_agent_follow_up_idx on public.leads (assigned_agent_id, next_follow_up_at) where deleted_at is null;
create index lead_interactions_lead_time_idx on public.lead_interactions (lead_id, happened_at desc);

create function public.touch_lead_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger leads_touch_updated_at
before update on public.leads
for each row execute function public.touch_lead_updated_at();

revoke execute on function public.touch_lead_updated_at() from public, anon, authenticated;

alter table public.leads enable row level security;
alter table public.lead_interactions enable row level security;

create policy "employees_manage_leads" on public.leads
for all to authenticated using (true) with check (true);

create policy "employees_manage_lead_interactions" on public.lead_interactions
for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.leads, public.lead_interactions to authenticated;
