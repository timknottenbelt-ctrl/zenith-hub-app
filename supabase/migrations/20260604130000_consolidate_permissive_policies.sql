-- Resolve the `multiple_permissive_policies` advisor warnings by merging the
-- "own row" + "admin sees all" policy pairs into a single policy per action,
-- scoped to `authenticated` (anon has no business reading these tables, and this
-- also avoids anon evaluating has_role()). Behavior for logged-in users and
-- admins is preserved (own OR admin).

-- ── profiles: SELECT ──
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read own" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (((select auth.uid()) = id) OR has_role((select auth.uid()), 'admin'::app_role));

-- ── profiles: UPDATE ──
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (((select auth.uid()) = id) OR has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (((select auth.uid()) = id) OR has_role((select auth.uid()), 'admin'::app_role));

-- ── user_roles: SELECT ──
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (((select auth.uid()) = user_id) OR has_role((select auth.uid()), 'admin'::app_role));

-- ── fda_email_drafts: stop the service-role ALL policy from overlapping the
--    per-user SELECT policy for the public role group. ──
ALTER POLICY "Service role can do everything" ON public.fda_email_drafts TO service_role;
