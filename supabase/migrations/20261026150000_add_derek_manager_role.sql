insert into public.panel_user_roles (clerk_user_id, role, created_at, updated_at)
values ('user_3KKNOukrk0H9t5x54noQHTY5XVZ', 'manager', now(), now())
on conflict (clerk_user_id) do update
set role = excluded.role,
    updated_at = now();
