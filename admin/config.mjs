// Supabase connection for the admin app. The anon key is PUBLIC by design (same as index.html);
// all authorisation is enforced in Postgres by RLS + yw_is_admin(). Never put a service-role key here.
// For local development against a DEV project, create admin/config.local.mjs (git-ignored) with the same shape
// and env: 'development'. The admin header always shows which database you are connected to.
export default {
  url: 'https://fktertkyldwviaqnjtmj.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrdGVydGt5bGR3dmlhcW5qdG1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MzcxNDYsImV4cCI6MjEwNjAxMzE0Nn0.iraWh8Ra7Re3T7PwxAGbFV-T4EBH7z7DSacNVKm-1GE',
  env: 'production'
};
