// generate-da-pdf — renders a stored DA (da_outputs row) to a PDF in the LBH
// "Estimated Disbursement Account" house style (header/footer band, logo,
// bordered cost table), uploads it to the da-pdfs bucket, stores the url on the
// row, and returns it. Dual auth: x-api-key OR user.
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "npm:pdf-lib@1.17.1";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { reportError } from "../_shared/tados.ts";
import { requireUser } from "../_shared/auth.ts";
import { LBH_LOGO_B64 } from "./logo.ts";

interface Line { label: string; currency?: string; amount: number }

const NAVY = rgb(0.07, 0.13, 0.30);   // LBH brand navy
const DARK = rgb(0.12, 0.12, 0.14);
const GREY = rgb(0.42, 0.45, 0.50);
const HAIR = rgb(0.78, 0.80, 0.83);   // hairline borders
const HEAD = rgb(0.93, 0.94, 0.96);   // table header / total fill

const CONTACT =
  "LBH Curaçao N.V.  |  Johan van Walbeeckplein 12  |  Willemstad  |  Curaçao  |  Phone +599 9 8432424  |  agency@LBHCuracao.com";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const eu = (n: number) =>
  Number(n ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const logo = await pdf.embedPng(b64ToBytes(LBH_LOGO_B64));

    const W = 595, H = 842, M = 50;
    const RIGHT = W - M;

    const draw = (p: PDFPage, s: string, x: number, y: number, size = 10, f: PDFFont = font, color = DARK) =>
      p.drawText(s, { x, y, size, font: f, color });
    const drawRight = (p: PDFPage, s: string, xRight: number, y: number, size = 10, f: PDFFont = font, color = DARK) =>
      p.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y, size, font: f, color });

    const headerFooter = (p: PDFPage) => {
      // top contact band
      draw(p, CONTACT, M, H - 30, 7.5, font, GREY);
      p.drawLine({ start: { x: M, y: H - 38 }, end: { x: RIGHT, y: H - 38 }, thickness: 0.6, color: HAIR });
      // footer band
      p.drawLine({ start: { x: M, y: 44 }, end: { x: RIGHT, y: 44 }, thickness: 0.6, color: HAIR });
      draw(p, CONTACT, M, 32, 7.5, font, GREY);
    };

    const wrap = (text: string, x: number, startY: number, p: PDFPage, size = 10, lh = 14, maxW = RIGHT - M): number => {
      const words = text.split(/\s+/);
      let line = "", y = startY;
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > maxW && line) {
          draw(p, line, x, y, size); y -= lh; line = w;
        } else line = test;
      }
      if (line) { draw(p, line, x, y, size); y -= lh; }
      return y;
    };

    let page = pdf.addPage([W, H]);
    headerFooter(page);

    const docWord = da.doc_type === "FDA" ? "Final" : da.doc_type === "PDA" ? "Proforma" : "Estimated";
    const expensesWord = docWord.toLowerCase();
    const vessel = da.vessel_name ? `M/T ${da.vessel_name}` : "the vessel";

    // Title + logo
    let y = H - 95;
    draw(page, `${docWord} disbursement account`, M, y, 16, bold, DARK);
    const lw = 132, lh = lw * (173 / 260);
    page.drawImage(logo, { x: RIGHT - lw, y: y - 28, width: lw, height: lh });

    y -= 55;
    draw(page, "To:", M, y, 10, bold);
    draw(page, String(da.client_name || da.client_email || "-"), M + 32, y, 10);
    y -= 26;

    y = wrap(
      `With reference to your request we have the pleasure to provide you with the ${expensesWord} port expenses for ${vessel}.`,
      M, y, page, 10, 14);
    y -= 8;

    draw(page, "Based on the following:", M, y, 10, bold); y -= 16;
    const basis: [string, unknown][] = [
      ["Purpose of call", da.operation_type],
      ["Terminal / quay", da.terminal],
      ["GT", da.gt],
      ["Port stay", da.port_stay != null && da.port_stay !== "" ? `${da.port_stay} days` : null],
      ["Tugs", da.tugs],
    ];
    for (const [k, v] of basis) {
      if (v == null || v === "") continue;
      draw(page, k, M, y, 9.5, font, GREY);
      draw(page, String(v), M + 130, y, 9.5);
      y -= 14;
    }
    y -= 14;

    // ── Cost table ──
    const xDiv = RIGHT - 118;       // start of the amount cell (USD + number)
    const xUSD = xDiv + 8;
    const rowH = 17;

    const tableTop = y + 4;
    const drawTableHeader = (top: number) => {
      page.drawRectangle({ x: M, y: top - rowH, width: RIGHT - M, height: rowH, color: HEAD });
      draw(page, "Items", M + 8, top - rowH + 5, 9.5, bold, DARK);
      drawRight(page, "Amount", RIGHT - 8, top - rowH + 5, 9.5, bold, DARK);
      return top - rowH;
    };
    y = drawTableHeader(tableTop);

    const lines: Line[] = [...(da.lines ?? []), ...(da.extra_lines ?? [])];
    for (const l of lines) {
      if (y - rowH < 90) {
        // overflow: close current table border, new page, repeat header
        page.drawRectangle({ x: M, y, width: RIGHT - M, height: tableTop - y, borderColor: HAIR, borderWidth: 0.8 });
        page = pdf.addPage([W, H]);
        headerFooter(page);
        y = drawTableHeader(H - 80);
      }
      const top = y;
      draw(page, String(l.label), M + 8, top - rowH + 5, 9.5);
      draw(page, "USD", xUSD, top - rowH + 5, 9.5, font, GREY);
      drawRight(page, `(${eu(l.amount)})`, RIGHT - 8, top - rowH + 5, 9.5);
      page.drawLine({ start: { x: M, y: top - rowH }, end: { x: RIGHT, y: top - rowH }, thickness: 0.5, color: HAIR });
      y -= rowH;
    }

    // Total row
    page.drawRectangle({ x: M, y: y - rowH, width: RIGHT - M, height: rowH, color: HEAD });
    draw(page, "Total", M + 8, y - rowH + 5, 10, bold, NAVY);
    draw(page, "USD", xUSD, y - rowH + 5, 10, bold, NAVY);
    drawRight(page, `(${eu(da.total)})`, RIGHT - 8, y - rowH + 5, 10, bold, NAVY);
    y -= rowH;

    // Outer + vertical divider borders for the whole table
    page.drawRectangle({ x: M, y, width: RIGHT - M, height: tableTop - y, borderColor: HAIR, borderWidth: 0.8 });
    page.drawLine({ start: { x: xDiv, y }, end: { x: xDiv, y: tableTop }, thickness: 0.5, color: HAIR });

    y -= 26;
    draw(page, "Above calculation is based on an average port call without delays and surcharges.", M, y, 9, font, GREY); y -= 22;
    draw(page, "Needless to say that we look forward to cooperation and await your agency nomination.", M, y, 9, font, GREY); y -= 16;
    draw(page, "Once we have received your agency nomination we shall forward the PDA including our banking details.", M, y, 9, font, GREY); y -= 34;

    draw(page, "Yours faithfully,", M, y, 10); y -= 18;
    draw(page, "LBH Curaçao N.V.", M, y, 10, bold);

    const bytes = await pdf.save();
    const safeVessel = (da.vessel_name || "vessel").replace(/[^a-zA-Z0-9]+/g, "_");
    const path = `${da.id}/${da.doc_type || "DA"}-${safeVessel}-${da.id}.pdf`;
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
