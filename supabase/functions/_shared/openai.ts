// Shared OpenAI helper — replaces the n8n LangChain OpenAI nodes
// (lmChatOpenAi, embeddingsOpenAi, outputParserStructured).
// Plain fetch, no extra deps. Requires the OPENAI_API_KEY edge secret.
//
// Embedding model is text-embedding-3-small (1536 dims) to match the existing
// vector(1536) columns in the database. Do not change without re-embedding.

const OPENAI_BASE = "https://api.openai.com/v1";
export const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dims — matches DB
export const DEFAULT_CHAT_MODEL = "gpt-4o"; // override per call as needed

function apiKey(): string {
  const k = Deno.env.get("OPENAI_API_KEY");
  if (!k) throw new Error("OPENAI_API_KEY not configured");
  return k;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  /** When set, forces JSON output (replaces n8n structured output parser). */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

/** Chat completion. Returns the assistant message content (string). */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model || DEFAULT_CHAT_MODEL,
    messages,
    temperature: opts.temperature ?? 0.2,
  };
  if (opts.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.jsonSchema.name, schema: opts.jsonSchema.schema, strict: true },
    };
  }

  const resp = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`OpenAI chat failed: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Chat completion that returns parsed JSON (use with opts.jsonSchema). */
export async function chatJSON<T = unknown>(messages: ChatMessage[], opts: ChatOptions): Promise<T> {
  const text = await chat(messages, opts);
  return JSON.parse(text) as T;
}

/** Embed a single string → 1536-dim vector. */
export async function embed(text: string): Promise<number[]> {
  const resp = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!resp.ok) {
    throw new Error(`OpenAI embeddings failed: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  return data.data?.[0]?.embedding ?? [];
}
