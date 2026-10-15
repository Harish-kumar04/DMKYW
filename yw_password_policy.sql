-- =====================================================================
-- DMK Youth Wing: Admin Password Policy & 14-Day Expiration Migration
-- Run AFTER: yw_admin_v2.sql
-- Rollback: yw_password_policy_rollback.sql
-- =====================================================================

-- 1. Add expiration tracking columns to yw_admins
alter table public.yw_admins
  add column if not exists password_changed_at timestamptz not null default now(),
  add column if not exists password_expires_at timestamptz not null default (now() + interval '14 days');

-- Restrict direct updates: only security-definer RPCs may modify yw_admins
revoke update on public.yw_admins from anon, authenticated;

-- 2. Server-enforce 14-day expiration in RLS:
-- If password_expires_at <= now(), yw_is_admin() returns false.
-- All admin RLS policies immediately deny access to protected tables and views.
create or replace function public.yw_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.yw_admins
    where user_id = auth.uid()
      and password_expires_at > now()
  );
$$;

create or replace function public.yw_am_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.yw_is_admin();
$$;
grant execute on function public.yw_am_admin() to authenticated;

-- 3. Expiration inspection RPC: callable by authenticated users
-- Returns admin status and remaining days even if the password is expired,
-- allowing the client to render the mandatory password renewal screen.
create or replace function public.yw_admin_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_admin public.yw_admins%rowtype;
  v_is_expired boolean;
  v_days_left int;
begin
  if auth.uid() is null then
    return jsonb_build_object('is_admin', false, 'is_expired', false);
  end if;

  select * into v_admin from public.yw_admins where user_id = auth.uid();
  if not found then
    return jsonb_build_object('is_admin', false, 'is_expired', false);
  end if;

  v_is_expired := (v_admin.password_expires_at <= now());
  v_days_left := greatest(0, floor(extract(epoch from (v_admin.password_expires_at - now())) / 86400)::int);

  return jsonb_build_object(
    'is_admin', true,
    'is_expired', v_is_expired,
    'days_remaining', v_days_left,
    'password_changed_at', v_admin.password_changed_at,
    'password_expires_at', v_admin.password_expires_at,
    'email', v_admin.email
  );
end $$;
grant execute on function public.yw_admin_status() to authenticated;

-- 4. Record password change RPC:
-- Invoked after successful password change via Supabase Auth.
-- Updates password_changed_at and sets password_expires_at to now() + 14 days.
-- Writes a non-sensitive audit log entry to yw_audit_log.
create or replace function public.yw_admin_record_password_change()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_admin public.yw_admins%rowtype;
  v_new_exp timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_admin from public.yw_admins where user_id = auth.uid();
  if not found then
    raise exception 'Not authorised as an administrator';
  end if;

  v_new_exp := now() + interval '14 days';

  update public.yw_admins
  set password_changed_at = now(),
      password_expires_at = v_new_exp
  where user_id = auth.uid();

  -- Log password change event to audit log (passwords are never logged)
  insert into public.yw_audit_log (
    actor, actor_email, action, table_name, row_id, before, after
  ) values (
    auth.uid(),
    v_admin.email,
    'PASSWORD_CHANGE',
    'yw_admins',
    auth.uid()::text,
    jsonb_build_object('password_changed_at', v_admin.password_changed_at, 'password_expires_at', v_admin.password_expires_at),
    jsonb_build_object('password_changed_at', now(), 'password_expires_at', v_new_exp)
  );

  return jsonb_build_object(
    'success', true,
    'password_changed_at', now(),
    'password_expires_at', v_new_exp
  );
end $$;
grant execute on function public.yw_admin_record_password_change() to authenticated;
