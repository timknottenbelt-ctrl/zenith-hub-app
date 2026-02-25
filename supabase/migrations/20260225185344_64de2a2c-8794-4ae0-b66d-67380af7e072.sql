
-- Create owners_kb_embeddings table
CREATE TABLE IF NOT EXISTS public.owners_kb_embeddings (
  id bigserial PRIMARY KEY,
  content text,
  metadata jsonb,
  embedding vector(1536)
);

-- Enable RLS
ALTER TABLE public.owners_kb_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_kb_embeddings ENABLE ROW LEVEL SECURITY;

-- Policies (use IF NOT EXISTS pattern via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'owners_kb_embeddings' AND policyname = 'Authenticated users can read owners_kb_embeddings') THEN
    CREATE POLICY "Authenticated users can read owners_kb_embeddings"
      ON public.owners_kb_embeddings FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cargo_kb_embeddings' AND policyname = 'Authenticated users can read cargo_kb_embeddings') THEN
    CREATE POLICY "Authenticated users can read cargo_kb_embeddings"
      ON public.cargo_kb_embeddings FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Populate owners_kb_embeddings
INSERT INTO public.owners_kb_embeddings (content, metadata)
SELECT content, jsonb_build_object('id', id, 'category', category, 'topic', topic, 'keywords', keywords)
FROM public.curacao_knowledge
WHERE keywords IS NULL OR NOT (keywords @> ARRAY['CARGO_AGENT']);

-- Populate cargo_kb_embeddings (clear first to avoid duplicates)
DELETE FROM public.cargo_kb_embeddings;
INSERT INTO public.cargo_kb_embeddings (content, metadata)
SELECT content, jsonb_build_object('id', id, 'category', category, 'topic', topic, 'keywords', keywords)
FROM public.curacao_knowledge
WHERE keywords @> ARRAY['CARGO_AGENT'];
