alter table public.leads
  drop constraint if exists leads_contact_required;

alter table public.leads
  add constraint leads_contact_required
  check (
    nullif(btrim(email), '') is not null
    or nullif(btrim(phone), '') is not null
  ) not valid;
