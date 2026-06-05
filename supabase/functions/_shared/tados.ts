// TADOS error reporting — forwards edge-function errors to the external TADOS
// error-monitor (the same ingest endpoint the old n8n "TADOS Error Handler"
// posted to). Configured via the TADOS_INGEST_URL + TADOS_INGEST_KEY secrets.
// Fire-and-forget: reporting never throws into the caller.

export async function reportError(
  source: string,
  error: unknown,
  context: Record<string, unknown> = {},
): Promise<number | null> {
  const url = Deno.env.get("TADOS_INGEST_URL");
  const key = Deno.env.get("TADOS_INGEST_KEY");
  if (!url || !key) return null;

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? (error.stack ?? "") : "";

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tados-key": key,
      },
      body: JSON.stringify({
        // The TADOS monitor currently only accepts source_type "n8n"; Supabase
        // errors are tagged via the source_id prefix instead.
        source_type: "n8n",
        source_id: `supabase/${source}`,
        severity: "error",
        message,
        stack_trace: stack,
        context,
        occurred_at: new Date().toISOString(),
      }),
    });
    if (!resp.ok) console.error(`[tados] ingest returned ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    return resp.status;
  } catch (e) {
    console.error("[tados] report failed:", e);
    return null;
  }
}
