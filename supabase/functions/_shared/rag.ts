// Shared RAG helper — replaces the n8n `vectorStoreSupabase` retrieval nodes.
// Combines OpenAI embeddings with the existing pgvector RPCs in the database:
//   - match_documents(query_embedding vector, match_count int, filter jsonb)  [semantic]
//   - search_curacao_knowledge / search_cargo_knowledge / search_owners_knowledge
//     / search_cargo_agent_knowledge / search_by_keyword (keyword)
//
// Requires a Supabase client (service-role) + OPENAI_API_KEY.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.90.1";
import { embed } from "./openai.ts";

export interface MatchedDoc {
  id: number | string;
  content: string;
  metadata?: Record<string, unknown>;
  similarity?: number;
}

/**
 * Semantic search via the standard `match_documents` RPC (curacao_knowledge store).
 * @param filter optional jsonb metadata filter (e.g. { category: "tariffs" })
 */
export async function semanticSearch(
  client: SupabaseClient,
  query: string,
  matchCount = 5,
  filter: Record<string, unknown> = {},
): Promise<MatchedDoc[]> {
  const embedding = await embed(query);
  const { data, error } = await client.rpc("match_documents", {
    query_embedding: embedding,
    match_count: matchCount,
    filter,
  });
  if (error) throw new Error(`match_documents failed: ${error.message}`);
  return (data ?? []) as MatchedDoc[];
}

type KeywordRpc =
  | "search_curacao_knowledge"
  | "search_cargo_knowledge"
  | "search_owners_knowledge"
  | "search_cargo_agent_knowledge";

/** Keyword search against one of the knowledge bases via its RPC. */
export async function keywordSearch(
  client: SupabaseClient,
  rpc: KeywordRpc,
  searchTerm: string,
): Promise<unknown[]> {
  const { data, error } = await client.rpc(rpc, { search_term: searchTerm });
  if (error) throw new Error(`${rpc} failed: ${error.message}`);
  return data ?? [];
}

/** Generic keyword search via `search_by_keyword(keyword_text)`. */
export async function searchByKeyword(client: SupabaseClient, keyword: string): Promise<unknown[]> {
  const { data, error } = await client.rpc("search_by_keyword", { keyword_text: keyword });
  if (error) throw new Error(`search_by_keyword failed: ${error.message}`);
  return data ?? [];
}

/** Hybrid: run semantic + keyword in parallel and merge (semantic first). */
export async function hybridSearch(
  client: SupabaseClient,
  query: string,
  matchCount = 5,
): Promise<{ semantic: MatchedDoc[]; keyword: unknown[] }> {
  const [semantic, keyword] = await Promise.all([
    semanticSearch(client, query, matchCount),
    searchByKeyword(client, query).catch(() => []),
  ]);
  return { semantic, keyword };
}
