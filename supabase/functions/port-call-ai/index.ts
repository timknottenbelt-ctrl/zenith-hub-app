// port-call-ai — reads the email correspondence of one port call and returns a
// short status summary, captain/client updates, and concrete human-in-the-loop
// to-dos. Read-only: it never sends anything. Called from the dossier's AI
// button via supabase.functions.invoke('port-call-ai', { body: { emailIds } }).
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { chat } from "../_shared/openai.ts";

const PROMPT = `Je bent de operations-assistent van LBH Curaçao, een ship's agency.
Hieronder staat de e-mailcorrespondentie van ÉÉN port call (één schip), chronologisch.
Analyseer en geef terug:
- "summary": korte stand van zaken in 2-3 zinnen (Nederlands).
- "updates": belangrijke wijzigingen/meldingen van de kapitein of klant
  (ETA-wijziging, SOF-update, nieuwe aanvraag, vertraging). Korte zinnen. Leeg als geen.
- "todos": concrete acties die de agent NU nog moet doen (human-in-the-loop),
  bv. "Douaneklaring aanvragen", "NOR doorsturen naar charterer", "Loods bevestigen",
  "Sludge-afvoer regelen". Alleen wat nog OPEN staat. Kort en imperatief.
Verzin niets dat niet uit de mails blijkt. Output ALLEEN JSON:
{"summary": string, "updates": string[], "todos": string[]}`;

function parseJson<T>(s: string): T {
  const f = s.replace(/```json/gi, "").replace(/```/g, "").trim();
  const m = f.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : f) as T;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  try {
    const { emailIds } = await req.json();
    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return jsonResponse({ error: "emailIds required" }, 400);
    }
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: emails, error } = await db
      .from("email")
      .select('subject, original_email, orignal_email, body, created_at, "Email Type", status')
      .in("id", emailIds)
      .order("created_at", { ascending: true });
    if (error) return jsonResponse({ error: error.message }, 500);

    const text = (emails ?? [])
      .map((e: Record<string, string | null>) => {
        const original = e.original_email ?? e.orignal_email ?? e.body ?? "";
        return `[${e.created_at}] (${e["Email Type"] ?? "?"}/${e.status ?? "?"}) ${e.subject ?? ""}\n${original.slice(0, 1500)}`;
      })
      .join("\n\n---\n\n")
      .slice(0, 14000);

    const raw = await chat(
      [{ role: "system", content: PROMPT }, { role: "user", content: text }],
      { model: "gpt-4o-mini", temperature: 0.2 },
    );
    const parsed = parseJson<{ summary: string; updates: string[]; todos: string[] }>(raw);
    return jsonResponse({
      summary: parsed.summary ?? "",
      updates: Array.isArray(parsed.updates) ? parsed.updates : [],
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
