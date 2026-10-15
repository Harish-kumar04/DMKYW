-- =====================================================================
-- Additive Migration: Add video_url support to yw_feeds and yw_feed_public
-- Safe & idempotent: Does not alter or delete existing feed data.
-- =====================================================================

-- 1. Add video_url column to yw_feeds if not already present
ALTER TABLE public.yw_feeds ADD COLUMN IF NOT EXISTS video_url text;

-- 2. Drop existing view and recreate with video_url
-- Note: PostgreSQL requires dropping the view to change column order without 42P16 error.
DROP VIEW IF EXISTS public.yw_feed_public CASCADE;

CREATE VIEW public.yw_feed_public AS
SELECT f.id, f.title, f.description, f.photos, f.video_url, f.district, f.activity_date, f.is_sample, f.created_at,
       a.id AS activity_id, a.name AS activity, a.points,
       (SELECT string_agg(m.first_name, ', ' ORDER BY m.first_name)
          FROM public.yw_feed_credits c JOIN public.yw_member_ids m ON m.member_id = c.member_id
         WHERE c.feed_id = f.id AND NOT c.reversed) AS members
FROM public.yw_feeds f JOIN public.yw_activity_types a ON a.id = f.activity_type_id
WHERE f.status = 'published';

-- Re-grant access for anonymous and authenticated visitors
GRANT SELECT ON public.yw_feed_public TO anon, authenticated;

-- 3. Replace yw_admin_create_feed with optional p_video_url
DROP FUNCTION IF EXISTS public.yw_admin_create_feed(text,text,text[],text,int,date,text[],boolean,text);
DROP FUNCTION IF EXISTS public.yw_admin_create_feed(text,text,text[],text,int,date,text[],boolean,text,text);

CREATE OR REPLACE FUNCTION public.yw_admin_create_feed(
  p_title text, p_description text, p_photos text[], p_district text, p_activity int,
  p_date date, p_members text[], p_consent boolean, p_status text,
  p_video_url text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_pts int; v_m text;
BEGIN
  IF NOT yw_is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF p_status NOT IN ('draft','published') THEN RAISE EXCEPTION 'bad_status'; END IF;
  IF NOT coalesce(p_consent,false) THEN RAISE EXCEPTION 'consent_required'; END IF;
  SELECT points INTO v_pts FROM yw_activity_types WHERE id = p_activity;
  IF v_pts IS NULL THEN RAISE EXCEPTION 'bad_activity'; END IF;
  INSERT INTO yw_feeds (title, description, photos, district, activity_type_id, activity_date, consent, status, video_url)
  VALUES (trim(p_title), trim(p_description), coalesce(p_photos,'{}'), p_district, p_activity, p_date, true, p_status, nullif(trim(p_video_url),''))
  RETURNING id INTO v_id;
  FOREACH v_m IN ARRAY coalesce(p_members,'{}') LOOP
    v_m := upper(trim(v_m));
    IF v_m = '' THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM yw_member_ids WHERE member_id = v_m) THEN RAISE EXCEPTION 'unknown_member: %', v_m; END IF;
    INSERT INTO yw_feed_credits (feed_id, member_id, points, credit_date) VALUES (v_id, v_m, v_pts, p_date);
  END LOOP;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.yw_admin_create_feed(text,text,text[],text,int,date,text[],boolean,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.yw_admin_create_feed(text,text,text[],text,int,date,text[],boolean,text,text) TO authenticated;
