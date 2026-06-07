// calculate-da — computes a full Disbursement Account for a vessel using the DA
// rate tables (da_* tables) + _shared/da.ts, merges any user-added extra lines,
// optionally stores the result in da_outputs, and returns it.
//
// Dual auth: x-api-key (server/n8n) OR a logged-in user (dashboard).
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { reportError } from "../_shared/tados.ts";
import { requireUser } from "../_shared/auth.ts";
import { calculateDA, type DaConfig, type DaVessel } from "../_shared/da.ts";
import { calculatePda } from "../_shared/pda.ts";

interface ExtraLine { label: string; amount: number; currency?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  // Auth: machine key OR logged-in user.
  const apiKey = Deno.env.get("INBOUND_API_KEY");
  const machineOk = apiKey && req.headers.get("x-api-key") === apiKey;
  if (!machineOk) {
    const auth = await requireUser(req);
    if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status ?? 401);
  }

  let body: {
    vessel?: DaVessel & {
      vessel_name?: string; operation_type?: string; cargo_type?: string;
      cargo_quantity?: number; area?: string; terminal?: string;
      client_name?: string; client_email?: string;
    };
    extra_lines?: ExtraLine[];
    source?: string; source_id?: number; doc_type?: string;
    store?: boolean;
    agency_fee?: number;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const v = body.vessel;
  if (!v || v.gt == null) return jsonResponse({ error: "vessel.gt is required" }, 400);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    // Load rate config.
    const [pil, tow, lin, set] = await Promise.all([
      db.from("da_pilotage_tariffs").select("gt_min,gt_max,pilotage_ang,hc_surcharge_ang").eq("is_active", true),
      db.from("da_towage_tariffs").select("gt_min,gt_max,tariff_a").eq("is_active", true),
      db.from("da_linesmen_tariffs").select("gt_min,gt_max,amount").eq("is_active", true),
      db.from("da_settings").select("key,value"),
    ]);
    const settings: Record<string, number> = {};
    for (const r of set.data ?? []) settings[r.key] = Number(r.value);
    const config: DaConfig = {
      pilotage: (pil.data ?? []) as DaConfig["pilotage"],
      towage: (tow.data ?? []) as DaConfig["towage"],
      linesmen: (lin.data ?? []) as DaConfig["linesmen"],
      settings,
    };

    // Auto-derive tugs + port stay from the rate tables (the n8n logic) unless the
    // caller passed explicit values — so the EDA fills itself from the inquiry.
    const [tugRes, rateRes, termRes] = await Promise.all([
      db.from("tug_rules").select("*"),
      db.from("loading_rates").select("*"),
      db.from("terminal_assignments").select("*"),
    ]);
    const pda = calculatePda(
      {
        name: v.vessel_name, loa: v.loa, grt: v.gt,
        operation_type: v.operation_type, cargo_type: v.cargo_type, cargo_quantity: v.cargo_quantity,
        terminal: v.terminal, area: v.area,
      } as never,
      { tugRules: tugRes.data ?? [], loadingRates: rateRes.data ?? [], terminalAssignments: termRes.data ?? [] },
    );
    const autoTugs = v.tugs ?? pda.tugs ?? 0;
    const autoStay = v.port_stay ?? pda.port_stay ?? 1;
    const vesselForDa: DaVessel & Record<string, unknown> = {
      ...v,
      tugs: autoTugs,
      port_stay: autoStay,
      linesmen_hours: v.linesmen_hours ?? 2,
      facility: v.facility ?? pda.facility ?? "Bouy",
    };

    const da = calculateDA(vesselForDa, config);

    // Per-client agency fee override (the agency fee differs per client, so the
    // dashboard sets it explicitly). Replaces the auto-computed agency fee line.
    if (body.agency_fee != null && Number.isFinite(Number(body.agency_fee))) {
      const af = da.lines.find((l) => l.label.toLowerCase().startsWith("agency fee"));
      if (af) af.amount = Math.round(Number(body.agency_fee) * 100) / 100;
      da.total = Math.round(da.lines.reduce((a, l) => a + l.amount, 0) * 100) / 100;
    }

    // Merge user-added extra lines (NGO agency fee, bank charges, ...).
    const extra = (body.extra_lines ?? []).map((e) => ({
      label: e.label, currency: e.currency ?? "USD", amount: Math.round(Number(e.amount) * 100) / 100,
    }));
    const total = Math.round((da.total + extra.reduce((a, e) => a + e.amount, 0)) * 100) / 100;

    let da_output_id: number | null = null;
    if (body.store) {
      const row = {
        source: body.source ?? "manual", source_id: body.source_id ?? null,
        doc_type: body.doc_type ?? "PDA",
        vessel_name: v.vessel_name ?? null, gt: v.gt, loa: v.loa ?? null, dwt: v.dwt ?? null,
        port_stay: autoStay, tugs: autoTugs, linesmen_hours: vesselForDa.linesmen_hours ?? null,
        facility: vesselForDa.facility ?? null, area: v.area ?? null, terminal: v.terminal ?? null,
        operation_type: v.operation_type ?? null, cargo_type: v.cargo_type ?? null, cargo_quantity: v.cargo_quantity ?? null,
        client_name: v.client_name ?? null, client_email: v.client_email ?? null,
        lines: da.lines, extra_lines: extra, total, status: "draft",
      };
      const { data, error } = await db.from("da_outputs").insert(row).select("id").single();
      if (error) return jsonResponse({ error: error.message }, 500);
      da_output_id = data.id;
    }

    return jsonResponse({ success: true, da_output_id, lines: da.lines, extra_lines: extra, total, tugs: autoTugs, port_stay: autoStay });
  } catch (error) {
    console.error("[calculate-da] error:", error);
    await reportError("calculate-da", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown" }, 500);
  }
});
