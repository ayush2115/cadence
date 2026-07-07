-- The service_role key (server-only, bypasses RLS) gets full table access so
-- admin/server operations and tooling work. Never exposed to the browser.
grant select, insert, update, delete on public.preferences to service_role;
grant select, insert, update, delete on public.tasks       to service_role;
grant select, insert, update, delete on public.plan_items  to service_role;
