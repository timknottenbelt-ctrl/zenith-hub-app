-- Semantic search over the comprehensive `curacao_knowledge` store (~9.8k rows,
-- includes the LBH owners/cargo agent tariff sheets with the actual USD prices).
-- The existing match_documents() only searches cargo_agent_knowledge (76 rows),
-- so owners-agent pricing questions never surfaced their tariffs. This RPC lets
-- compose-reply answer service questions (crew change, fresh water, …) with the
-- real prices.
CREATE OR REPLACE FUNCTION public.match_curacao_knowledge(
  query_embedding vector,
  match_count integer DEFAULT 5,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
begin
  return query
  select
    curacao_knowledge.id,
    curacao_knowledge.content,
    curacao_knowledge.metadata,
    1 - (curacao_knowledge.embedding <=> query_embedding) as similarity
  from curacao_knowledge
  where curacao_knowledge.embedding is not null
  order by curacao_knowledge.embedding <=> query_embedding
  limit match_count;
end;
$fn$;
