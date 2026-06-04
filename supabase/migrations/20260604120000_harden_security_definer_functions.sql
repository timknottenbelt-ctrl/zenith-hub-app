-- Harden SECURITY DEFINER functions so the public/anon API cannot invoke them.
-- Flagged by the Supabase security advisor (lint 0028).
--
-- Trigger + utility functions must NOT be callable via /rest/v1/rpc.
-- has_role / is_approved are used inside RLS policies, so `authenticated`
-- must keep EXECUTE, but anon/public should not be able to probe roles.

-- ── Trigger functions: nobody calls these directly ──
REVOKE EXECUTE ON FUNCTION public.handle_new_user()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;

-- ── Maintenance utility: service_role / cron only ──
REVOKE EXECUTE ON FUNCTION public.delete_old_email_logs() FROM PUBLIC, anon, authenticated;

-- ── RLS helper functions: keep authenticated, drop anon/public ──
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated, service_role;
