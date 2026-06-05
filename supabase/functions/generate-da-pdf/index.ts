// generate-da-pdf — renders a stored DA (da_outputs row) to a PDF in the LBH
// "Estimated Disbursement Account" layout, uploads it to the da-pdfs bucket,
// stores the url on the row, and returns it. Dual auth: x-api-key OR user.
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { reportError } from "../_shared/tados.ts";
import { requireUser } from "../_shared/auth.ts";

interface Line { label: string; currency: string; amount: number }
const BLUE = rgb(0.1, 0.34, 0.86);
const GREY = rgb(0.42, 0.45, 0.5);
const DARK = rgb(0.1, 0.1, 0.12);

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
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const W = 595, M = 50;
    let y = 800;

    const text = (s: string, x: number, size = 10, f = font, color = DARK) => page.drawText(s, { x, y, size, font: f, color });
    const money = (n: number) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Header
    text("LBH CURACAO", M, 20, bold, BLUE);
    text("Maritime Services", M, 10, font, GREY); y -= 18;
    page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 1, color: BLUE }); y -= 28;

    const title = (da.doc_type === "EDA" ? "Estimated" : da.doc_type === "FDA" ? "Final" : "Proforma") + " Disbursement Account";
    text(title, M, 16, bold); y -= 30;

    text("To:", M, 10, bold); text(String(da.client_name || da.client_email || "-"), M + 40, 10); y -= 18;
    text(`Re: ${da.vessel_name || "-"}`, M, 10, bold); y -= 24;

    text("Based on the following:", M, 10, bold); y -= 16;
    for (const [k, v] of [["Purpose of call", da.operation_type], ["Terminal / quay", da.terminal], ["GT", da.gt], ["Port stay", da.port_stay ? `${da.port_stay} days` : null], ["Tugs", da.tugs]]) {
      if (v == null || v === "") continue;
      text(String(k), M, 9, font, GREY); text(String(v), M + 130, 9); y -= 14;
    }
    y -= 10;

    // Table header
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 18, color: rgb(0.95, 0.96, 0.98) });
    text("Items", M + 6, 10, bold); text("Amount (USD)", W - M - 100, 10, bold); y -= 22;

    const lines: Line[] = [...(da.lines ?? []), ...(da.extra_lines ?? [])];
    for (const l of lines) {
      text(String(l.label), M + 6, 9.5);
      const amt = money(l.amount);
      text(amt, W - M - 6 - font.widthOfTextAtSize(amt, 9.5), 9.5);
      y -= 15;
      if (y < 120) { y = 800; pdf.addPage([595, 842]); } // simplistic overflow guard
    }
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.8, color: GREY }); y -= 14;
    text("TOTAL", M + 6, 11, bold);
    const tot = money(da.total);
    text(tot, W - M - 6 - bold.widthOfTextAtSize(tot, 11), 11, bold, BLUE); y -= 28;

    text("Above calculation is based on an average port call without delays and surcharges.", M, 8.5, font, GREY); y -= 30;
    text("Yours faithfully,", M, 10); y -= 16;
    text("LBH Curacao", M, 10, bold);
    text("agency@lbhcuracao.com  -  www.lbh-curacao.com", M, 8.5, font, GREY);

    const bytes = await pdf.save();
    const path = `${da.id}/DA-${(da.vessel_name || "vessel").replace(/[^a-zA-Z0-9]+/g, "_")}-${da.id}.pdf`;
    const up = await db.storage.from("da-pdfs").upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (up.error) return jsonResponse({ error: up.error.message }, 500);

    const url = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/da-pdfs/${path}`;
    await db.from("da_outputs").update({ pdf_url: url }).eq("id", da.id);
    return jsonResponse({ success: true, pdf_url: url });
  } catch (e) {
    console.error("[generate-da-pdf]", e);
    await reportError("generate-da-pdf", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
