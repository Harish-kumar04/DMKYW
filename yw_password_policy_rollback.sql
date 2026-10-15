-- =====================================================================
-- DMK Youth Wing: Admin Password Policy Rollback
-- Reverts: yw_password_policy.sql
-- =====================================================================

-- 1. Restore original yw_is_admin() and yw_am_admin()
create or replace function public.yw_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from yw_admins where user_id = auth.uid());
$$;

create or replace function public.yw_am_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select yw_is_admin();
$$;

-- 2. Drop the newly added RPCs
drop function if exists public.yw_admin_status();
drop function if exists public.yw_admin_record_password_change();

-- 3. Drop columns if desired (or leave them safe)
alter table public.yw_admins
  drop column if exists password_changed_at,
  drop column if exists password_expires_at;
