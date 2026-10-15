-- =====================================================================
-- DMK Youth Wing: Authorize Administrators with 14-Day Expiration
-- Run this in Supabase > SQL Editor
-- =====================================================================

-- 1. Ensure yw_password_policy columns exist
ALTER TABLE public.yw_admins
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS password_expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days');

-- 2. Link administrators from auth.users to public.yw_admins
INSERT INTO public.yw_admins (user_id, email, password_changed_at, password_expires_at)
SELECT id, email, now(), now() + interval '14 days'
FROM auth.users
WHERE email IN (
  'harishkumar777.hk@gmail.com',
  'erharishkumarece@gmail.com',
  'dravidianismyorigin@gmail.com'
)
ON CONFLICT (user_id) DO UPDATE
SET password_changed_at = now(),
    password_expires_at = now() + interval '14 days';

-- 3. Verify all active administrator accounts
SELECT user_id, email, password_changed_at, password_expires_at
FROM public.yw_admins;
