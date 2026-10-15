-- =====================================================================
-- DMK Youth Wing: Admin system v2 (ADDITIVE migration).
-- Run AFTER: supabase_setup.sql -> supabase_voter_id.sql -> yw_features.sql
-- !! Test on a DEV project first. Do NOT run on production until approved. !!
-- Rollback: yw_admin_v2_rollback.sql
-- =====================================================================

-- ---------- 1. Members: admin read + limited update (never delete, never hashes) ----------
drop policy if exists yw_admin_read  on public.yw_members;
drop policy if exists yw_admin_upd   on public.yw_members;
create policy yw_admin_read on public.yw_members for select to authenticated using (public.yw_is_admin());
create policy yw_admin_upd  on public.yw_members for update to authenticated using (public.yw_is_admin()) with check (public.yw_is_admin());
-- Column privileges: admins may only change kit fields; hashes are never readable through the API.
revoke update on public.yw_members from authenticated;
grant  update (wants_kit, kit_size, kit_address, kit_pincode) on public.yw_members to authenticated;
revoke select on public.yw_members from anon, authenticated;
grant  select (id, name, district, contact, voter_last4, wants_kit, kit_size, kit_address, kit_pincode, created_at)
  on public.yw_members to authenticated;

-- Admin member list (runs with the CALLER's rights, so RLS applies: non-admins get 0 rows).
create or replace view public.yw_admin_members with (security_invoker = true) as
select m.id, x.member_id, m.name, m.district, m.contact, m.voter_last4,
       m.wants_kit, m.kit_size, m.kit_address, m.kit_pincode, m.created_at
from public.yw_members m left join public.yw_member_ids x on x.member_ref = m.id;
revoke all on public.yw_admin_members from anon, public;
grant select on public.yw_admin_members to authenticated;

-- ---------- 2. Audit log ----------
create table if not exists public.yw_audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid default auth.uid(),
  actor_email text,
  action text not null,               -- INSERT / UPDATE / DELETE / EXPORT
  table_name text not null,
  row_id text,
  before jsonb, after jsonb
);
create index if not exists yw_audit_at on public.yw_audit_log (at desc);
alter table public.yw_audit_log enable row level security;
drop policy if exists yw_admin_read on public.yw_audit_log;
create policy yw_admin_read on public.yw_audit_log for select to authenticated using (public.yw_is_admin());
-- No insert/update/delete policy: rows are written only by the security-definer functions below (append-only).

create or replace function public.yw_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare b jsonb; a jsonb; strip text[] := array['voter_hash','aadhaar_hash'];
begin
  -- Only log changes made through the API by a signed-in user (skips migrations / service jobs).
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op <> 'INSERT' then b := to_jsonb(old) - strip; end if;
  if tg_op <> 'DELETE' then a := to_jsonb(new) - strip; end if;
  insert into yw_audit_log (actor, actor_email, action, table_name, row_id, before, after)
  values (auth.uid(), (select email from yw_admins where user_id = auth.uid()), tg_op, tg_table_name,
          coalesce(a->>'id', b->>'id', a->>'key', b->>'key', a->>'feed_id', b->>'feed_id', a->>'week_start'), b, a);
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['yw_members','yw_member_ids','yw_complaints','yw_ideas','yw_feeds','yw_feed_credits',
    'yw_books','yw_podcast_episodes','yw_settings','yw_activity_types','yw_seva_star','yw_admins'] loop
    execute format('drop trigger if exists yw_audit on public.%I', t);
    execute format('create trigger yw_audit after insert or update or delete on public.%I for each row execute function public.yw_audit()', t);
  end loop;
end $$;

-- Exports are reads, so they are logged explicitly by the admin app.
create or replace function public.yw_admin_log_export(p_dataset text, p_format text, p_filters jsonb, p_rows int, p_pii boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not yw_is_admin() then raise exception 'not_admin'; end if;
  if p_dataset not in ('members','complaints','ideas') or p_format not in ('csv','xlsx') then raise exception 'bad_export'; end if;
  insert into yw_audit_log (actor, actor_email, action, table_name, after)
  values (auth.uid(), (select email from yw_admins where user_id = auth.uid()), 'EXPORT', p_dataset,
          jsonb_build_object('format', p_format, 'filters', p_filters, 'rows', p_rows, 'personal_data', p_pii));
end $$;
revoke all on function public.yw_admin_log_export(text,text,jsonb,int,boolean) from public, anon;
grant execute on function public.yw_admin_log_export(text,text,jsonb,int,boolean) to authenticated;

-- ---------- 3. Complaints: private internal note (never returned by yw_complaint_status) ----------
alter table public.yw_complaints add column if not exists internal_note text;

-- ---------- 4. Publish flags for books / podcast (default TRUE = no visible change) ----------
alter table public.yw_books            add column if not exists published boolean not null default true;
alter table public.yw_podcast_episodes add column if not exists published boolean not null default true;
drop policy if exists yw_pub_read on public.yw_books;
create policy yw_pub_read on public.yw_books for select to anon, authenticated using (published or public.yw_is_admin());
drop policy if exists yw_pub_read on public.yw_podcast_episodes;
create policy yw_pub_read on public.yw_podcast_episodes for select to anon, authenticated using (published or public.yw_is_admin());

-- ---------- 5. Feeds: allow drafts (public view already shows only 'published') ----------
do $$ declare c text; begin
  select conname into c from pg_constraint
   where conrelid = 'public.yw_feeds'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%';
  if c is not null then execute format('alter table public.yw_feeds drop constraint %I', c); end if;
end $$;
alter table public.yw_feeds add constraint yw_feeds_status_check check (status in ('draft','published','unpublished'));

-- Same as yw_admin_publish_feed but lets the admin save as draft (inserted with that status, never briefly public).
create or replace function public.yw_admin_create_feed(
  p_title text, p_description text, p_photos text[], p_district text, p_activity int,
  p_date date, p_members text[], p_consent boolean, p_status text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_pts int; v_m text;
begin
  if not yw_is_admin() then raise exception 'not_admin'; end if;
  if p_status not in ('draft','published') then raise exception 'bad_status'; end if;
  if not coalesce(p_consent,false) then raise exception 'consent_required'; end if;
  select points into v_pts from yw_activity_types where id = p_activity;
  if v_pts is null then raise exception 'bad_activity'; end if;
  insert into yw_feeds (title, description, photos, district, activity_type_id, activity_date, consent, status)
  values (trim(p_title), trim(p_description), coalesce(p_photos,'{}'), p_district, p_activity, p_date, true, p_status)
  returning id into v_id;
  foreach v_m in array coalesce(p_members,'{}') loop
    v_m := upper(trim(v_m));
    if v_m = '' then continue; end if;
    if not exists (select 1 from yw_member_ids where member_id = v_m) then raise exception 'unknown_member: %', v_m; end if;
    insert into yw_feed_credits (feed_id, member_id, points, credit_date) values (v_id, v_m, v_pts, p_date);
  end loop;
  return v_id;
end $$;
revoke all on function public.yw_admin_create_feed(text,text,text[],text,int,date,text[],boolean,text) from public, anon;
grant execute on function public.yw_admin_create_feed(text,text,text[],text,int,date,text[],boolean,text) to authenticated;

-- ---------- 6. Dashboard stats ----------
create or replace function public.yw_admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not yw_is_admin() then raise exception 'not_admin'; end if;
  return json_build_object(
    'members',        (select count(*) from yw_members),
    'members_30d',    (select count(*) from yw_members where created_at >= now() - interval '30 days'),
    'kit_requests',   (select count(*) from yw_members where wants_kit),
    'complaints',     (select json_object_agg(status, n) from (select status, count(*) n from yw_complaints group by status) s),
    'ideas',          (select json_object_agg(status, n) from (select status, count(*) n from yw_ideas group by status) s),
    'feeds_published',(select count(*) from yw_feeds where status = 'published'),
    'feeds_draft',    (select count(*) from yw_feeds where status = 'draft'),
    'episodes',       (select count(*) from yw_podcast_episodes),
    'books',          (select count(*) from yw_books),
    'points_awarded', (select coalesce(sum(points),0) from yw_feed_credits where not reversed),
    'top_districts',  (select json_agg(t) from (select district, count(*) n from yw_members group by district order by 2 desc limit 5) t)
  );
end $$;
revoke all on function public.yw_admin_stats() from public, anon;
grant execute on function public.yw_admin_stats() to authenticated;

-- ---------- 7. Admin leaderboard review (security_invoker => admin RLS) ----------
create or replace view public.yw_admin_member_points with (security_invoker = true) as
select m.member_id, m.first_name, m.district, m.is_sample,
       coalesce(sum(c.points) filter (where not c.reversed and f.status = 'published'), 0)::bigint as points,
       coalesce(sum(c.points) filter (where not c.reversed and f.status = 'published'
                and c.credit_date >= date_trunc('week', current_date)::date), 0)::bigint as week_points,
       count(c.id) filter (where c.reversed) as reversed_credits
from public.yw_member_ids m
left join public.yw_feed_credits c on c.member_id = m.member_id
left join public.yw_feeds f on f.id = c.feed_id
group by m.member_id, m.first_name, m.district, m.is_sample;
revoke all on public.yw_admin_member_points from anon, public;
grant select on public.yw_admin_member_points to authenticated;

-- ---------- 8. Rate limit: prefer the edge-verified client IP (x-forwarded-for first hop is spoofable) ----------
create or replace function public.yw_rate_ok(p_scope text, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare h json := coalesce(current_setting('request.headers', true), '{}')::json; v_ip text; v_k text; xff text[];
begin
  xff := string_to_array(coalesce(h->>'x-forwarded-for', ''), ',');
  v_ip := coalesce(nullif(h->>'cf-connecting-ip', ''), nullif(trim(xff[array_length(xff, 1)]), ''), 'na');
  v_k  := p_scope || ':' || encode(digest(v_ip, 'sha256'), 'hex');
  delete from yw_rate_log where at < now() - interval '1 day';
  if (select count(*) from yw_rate_log where k = v_k and at > now() - p_window) >= p_max then return false; end if;
  insert into yw_rate_log(k) values (v_k);
  return true;
end $$;
revoke all on function public.yw_rate_ok(text,int,interval) from public, anon, authenticated;

-- ---------- 9. Indexes for admin filters ----------
create index if not exists yw_members_created  on public.yw_members (created_at desc);
create index if not exists yw_members_district on public.yw_members (district);
create index if not exists yw_complaints_f     on public.yw_complaints (status, district, created_at desc);
create index if not exists yw_ideas_f          on public.yw_ideas (status, district, created_at desc);
create index if not exists yw_feeds_f          on public.yw_feeds (status, created_at desc);

-- ---------- 10. Initial admin (run manually, once, with YOUR email after creating the user in Auth > Users) ----------
-- insert into public.yw_admins (user_id, email) select id, email from auth.users where email = 'you@example.com';
