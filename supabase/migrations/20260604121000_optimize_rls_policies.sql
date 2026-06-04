-- Performance: wrap auth.* in (select ...) to avoid per-row re-eval (RLS initplan),
-- and drop exact-duplicate policies. Generated from live policy catalog.

-- Drop redundant duplicate policies
DROP POLICY "Users can read own profile" ON public."profiles";
DROP POLICY "Users can update own profile" ON public."profiles";

-- Optimize auth.* calls (initplan)
ALTER POLICY "Admin mail readable by authenticated" ON public."Admin_mail" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated users can read cargo_kb_embeddings" ON public."cargo_kb_embeddings" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated users can delete emails" ON public."email" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated users can update emails" ON public."email" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated can delete fda_creator_invoices" ON public."fda_creator_invoices" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated can insert fda_creator_invoices" ON public."fda_creator_invoices" WITH CHECK (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated can read fda_creator_invoices" ON public."fda_creator_invoices" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated can update fda_creator_invoices" ON public."fda_creator_invoices" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated can delete fda_creator_projects" ON public."fda_creator_projects" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated can insert fda_creator_projects" ON public."fda_creator_projects" WITH CHECK (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated can read fda_creator_projects" ON public."fda_creator_projects" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated can update fda_creator_projects" ON public."fda_creator_projects" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Service role can do everything" ON public."fda_email_drafts" USING (((select auth.role()) = 'service_role'::text));
ALTER POLICY "Users can view their own email drafts" ON public."fda_email_drafts" USING (((select auth.uid()) IS NOT NULL));
ALTER POLICY "Authenticated can delete knowledge_files" ON public."knowledge_files" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated can insert knowledge_files" ON public."knowledge_files" WITH CHECK (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated can read knowledge_files" ON public."knowledge_files" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated users can read owners_kb_embeddings" ON public."owners_kb_embeddings" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Profiles insert own" ON public."profiles" WITH CHECK (((select auth.uid()) = id));
ALTER POLICY "Admins can read all profiles" ON public."profiles" USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Profiles read own" ON public."profiles" USING (((select auth.uid()) = id));
ALTER POLICY "Admins can update all profiles" ON public."profiles" USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Profiles update own" ON public."profiles" USING (((select auth.uid()) = id));
ALTER POLICY "Admins can delete roles" ON public."user_roles" USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can view all roles" ON public."user_roles" USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users can view own role" ON public."user_roles" USING (((select auth.uid()) = user_id));
ALTER POLICY "Admins can update roles" ON public."user_roles" USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Authenticated users can delete vessels" ON public."vessels" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated users can insert vessels" ON public."vessels" WITH CHECK (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Authenticated users can update vessels" ON public."vessels" USING (((select auth.role()) = 'authenticated'::text));
