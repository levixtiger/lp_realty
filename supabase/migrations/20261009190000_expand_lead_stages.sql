alter table public.leads
  drop constraint if exists leads_status_check;

update public.leads
set status = case status
  when 'nurturing' then 'qualified'
  when 'converted' then 'win'
  else status
end;

alter table public.leads
  add constraint leads_status_check
    check (status in ('new', 'contacted', 'qualified', 'showing', 'offered', 'win', 'lost', 'not_interested'));
