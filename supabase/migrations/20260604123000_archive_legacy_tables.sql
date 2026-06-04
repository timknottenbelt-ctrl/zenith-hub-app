-- Move superseded legacy knowledge tables out of the public API surface.
-- They are replaced by public.cargo_agent_knowledge / public.curacao_knowledge
-- (the active embedding tables). Data is PRESERVED in the `archive` schema, so
-- this is fully reversible: ALTER TABLE archive.X SET SCHEMA public;
--
-- This also resolves the `rls_enabled_no_policy` advisor warnings, since these
-- tables are no longer exposed via PostgREST.

CREATE SCHEMA IF NOT EXISTS archive;

ALTER TABLE public.cargo_agent_knowledge_old SET SCHEMA archive;
ALTER TABLE public.curacao_knowledge_old     SET SCHEMA archive;
