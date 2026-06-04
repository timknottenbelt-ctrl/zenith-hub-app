// generate-da-excel — renders a stored DA (da_outputs row) to an .xlsx with the
// cost breakdown, uploads it to the da-pdfs bucket, stores the url, returns it.
// Dual auth: x-api-key OR user. Uses SheetJS (npm:xlsx).
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import * as XLSX from "npm:xlsx@0.18.5";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

interface Line { label: string; currency: string; amount: number }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("INBOUND_API_KEY");
  if (!(apiKey && req.headers.get("x-api-key") === apiKey)) {
    const auth = await requireUser(req);
    if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status ?? 401);
  }

  let body: { da_output_id?: number };
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }
  if (!body.da_output_id) return jsonResponse({ error: "da_output_id required" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: da, error } = await db.from("da_outputs").select("*").eq("id", body.da_output_id).single();
  if (error || !da) return jsonResponse({ error: "da_output not found" }, 404);

  try {
    const docName = da.doc_type === "EDA" ? "Estimated" : da.doc_type === "FDA" ? "Final" : "Proforma";
    const lines: Line[] = [...(da.lines ?? []), ...(da.extra_lines ?? [])];
    const aoa: (string | number)[][] = [
      [`LBH Curacao - ${docName} Disbursement Account`],
      [],
      ["To:", da.client_name || da.client_email || ""],
      ["Vessel:", da.vessel_name || ""],
      ["Purpose of call:", da.operation_type || ""],
      ["Terminal / quay:", da.terminal || ""],
      ["GT:", da.gt ?? ""],
      ["Port stay (days):", da.port_stay ?? ""],
      ["Tugs:", da.tugs ?? ""],
      [],
      ["Items", "Currency", "Amount"],
      ...lines.map((l) => [l.label, l.currency || "USD", Number(l.amount)]),
      ["TOTAL", "USD", Number(da.total)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 42 }, { wch: 10 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, da.doc_type || "DA");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;

    const path = `${da.id}/DA-${(da.vessel_name || "vessel").replace(/[^a-zA-Z0-9]+/g, "_")}-${da.id}.xlsx`;
    const up = await db.storage.from("da-pdfs").upload(path, buf, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
    if (up.error) return jsonResponse({ error: up.error.message }, 500);

    const url = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/da-pdfs/${path}`;
    await db.from("da_outputs").update({ excel_url: url }).eq("id", da.id);
    return jsonResponse({ success: true, excel_url: url });
  } catch (e) {
    console.error("[generate-da-excel]", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
