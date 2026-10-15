-- Rollback for yw_admin_v2.sql. Keeps data columns (internal_note, published) unless you uncomment the drops.
do $$ declare t text; begin
  foreach t in array array['yw_members','yw_member_ids','yw_complaints','yw_ideas','yw_feeds','yw_feed_credits',
    'yw_books','yw_podcast_episodes','yw_settings','yw_activity_types','yw_seva_star','yw_admins'] loop
    execute format('drop trigger if exists yw_audit on public.%I', t);
  end loop;
end $$;
drop function if exists public.yw_audit();
drop function if exists public.yw_admin_log_export(text,text,jsonb,int,boolean);
drop function if exists public.yw_admin_stats();
drop function if exists public.yw_admin_create_feed(text,text,text[],text,int,date,text[],boolean,text);
drop view if exists public.yw_admin_members;
drop view if exists public.yw_admin_member_points;
drop policy if exists yw_admin_read on public.yw_members;
drop policy if exists yw_admin_upd  on public.yw_members;
grant select, update on public.yw_members to authenticated;   -- restores default grants (RLS still blocks without policies)

drop policy if exists yw_pub_read on public.yw_books;
create policy yw_pub_read on public.yw_books for select to anon, authenticated using (true);
drop policy if exists yw_pub_read on public.yw_podcast_episodes;
create policy yw_pub_read on public.yw_podcast_episodes for select to anon, authenticated using (true);

update public.yw_feeds set status = 'unpublished' where status = 'draft';
alter table public.yw_feeds drop constraint if exists yw_feeds_status_check;
alter table public.yw_feeds add constraint yw_feeds_status_check check (status in ('published','unpublished'));

-- Optional (destroys data):
-- alter table public.yw_complaints drop column if exists internal_note;
-- alter table public.yw_books drop column if exists published;
-- alter table public.yw_podcast_episodes drop column if exists published;
-- drop table if exists public.yw_audit_log;
-- yw_rate_ok: re-run its definition from yw_features.sql to restore the old version.
