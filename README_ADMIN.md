# YouthWing Admin Console

Admin URL: **`/admin`** (file `admin.html`). The old `#yw/admin` link redirects there.

## Security model
- The browser only has the **public anon key** and the admin's own login token.
- Every read and write is checked **inside Postgres** by Row Level Security: `yw_is_admin()` checks that the user is listed in `yw_admins`.
- Editing browser storage, forging a role, or calling the API directly cannot give admin access.
- **Never** put a `service_role` key in any file.
- Login sessions refresh automatically. An idle admin is signed out after 30 minutes, and signing out revokes the token.
- Every admin change and every export is written to `yw_audit_log`. The app can only append to this log; nobody can edit or delete entries from it.
- Exports are created in the browser and downloaded directly. Nothing is uploaded or stored on a server.

## Set up (dev project first!)
1. In Supabase, open **SQL Editor** and run, in order: `supabase_setup.sql`, `supabase_voter_id.sql`, `yw_features.sql`, `yw_admin_v2.sql`.
2. Create the admin user in **Authentication → Users → Add user**. Then run:
   ```sql
   insert into public.yw_admins (user_id, email)
   select id, email from auth.users where email = 'you@example.com';
   ```
3. Recommended: **Authentication → Providers → Email → turn off "Allow new users to sign up"**.
4. Recommended: set **Authentication → URL Configuration → Site URL** to your domain.

To undo the changes: run `yw_admin_v2_rollback.sql`.

## Run locally
```powershell
python -m http.server 8080      # then open http://localhost:8080/admin.html
node --test tests/auth.test.mjs tests/query.test.mjs tests/export.test.mjs
```
To work against a **dev** project, create `admin/config.local.mjs` (it's in `.gitignore`):
```js
export default { url: 'https://<dev-ref>.supabase.co', anonKey: '<dev anon key>', env: 'development' };
```
The admin header always shows **Production database** or **Development database**.

Live RLS tests (dev only; they refuse to run against the production project ref):
```powershell
$env:YW_TEST_SUPABASE_URL='https://<dev-ref>.supabase.co'; $env:YW_TEST_ANON_KEY='...'
$env:YW_TEST_ADMIN_EMAIL='...'; $env:YW_TEST_ADMIN_PASSWORD='...'
$env:YW_TEST_USER_EMAIL='...';  $env:YW_TEST_USER_PASSWORD='...'
node --test tests/rls.live.test.mjs
```
