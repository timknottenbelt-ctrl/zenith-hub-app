// DA (Disbursement Account) cost engine — ports the LBH Curacao Excel "EDA" sheet.
// Pure rate-table lookups + formulas (no AI). Rate data lives in the Supabase
// tables da_pilotage_tariffs / da_towage_tariffs / da_linesmen_tariffs / da_settings,
// so tariffs stay editable in the dashboard.

export interface Bracket { gt_min: number; gt_max: number | null }
export interface PilotageRow extends Bracket { pilotage_ang: number; hc_surcharge_ang: number }
export interface TowageRow extends Bracket { tariff_a: number }
export interface LinesmenRow extends Bracket { amount: number }

export interface DaConfig {
  pilotage: PilotageRow[];
  towage: TowageRow[];
  linesmen: LinesmenRow[];
  settings: Record<string, number>;
}

export interface DaVessel {
  gt: number;
  dwt?: number;
  loa?: number;
  port_stay: number;
  tugs: number;
  linesmen_hours?: number;
  facility?: string; // "Quay" | "Bouy"
}

export interface DaLine { label: string; currency: string; amount: number }
export interface DaResult { lines: DaLine[]; total: number }

// Rate columns may arrive as strings (depending on the client) — coerce defensively.
const N = (v: unknown): number => Number(v) || 0;

function lookup<T extends Bracket>(rows: T[], gt: number): T | null {
  for (const r of rows) {
    const max = r.gt_max == null ? Infinity : N(r.gt_max);
    if (gt >= N(r.gt_min) && gt <= max) return r;
  }
  return null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Compute the estimated disbursement account for a vessel. */
export function calculateDA(v: DaVessel, cfg: DaConfig): DaResult {
  const s = new Proxy(cfg.settings, { get: (t, k: string) => N(t[k]) }) as Record<string, number>;
  const gt = N(v.gt);
  const stay = N(v.port_stay);

  // Pilotage: (pilotage + HC surcharge) ANG -> USD, charged inwards + outwards.
  const pil = lookup(cfg.pilotage, gt);
  const pilotageUSD = pil ? (N(pil.pilotage_ang) + N(pil.hc_surcharge_ang)) / s.ang_to_usd : 0;

  // Towage: GT-bracket tariff * number of tugs, inwards + outwards.
  const tow = lookup(cfg.towage, gt);
  const towageUSD = tow ? N(tow.tariff_a) * N(v.tugs) : 0;

  // Linesmen: GT-bracket base + per-hour * hours, mooring + unmooring.
  const lin = lookup(cfg.linesmen, gt);
  const linesmenUSD = (lin ? N(lin.amount) : 0) + s.linesmen_per_hour * N(v.linesmen_hours);

  // Wharfage: facility-dependent (Quay = tariff A, Bouy = tariff B).
  const isQuay = (v.facility || "Bouy").toLowerCase() === "quay";
  const wharfage = isQuay
    ? (gt < 533.5 ? s.wharfage_min_a * stay : gt * stay * s.wharfage_quay_per_gt)
    : (gt < 500 ? s.wharfage_min_b * stay : gt * stay * s.wharfage_bouy_per_gt);

  // Harbour dues.
  const harbour = gt < 100
    ? stay * s.harbour_tariff_min
    : (gt * s.harbour_tariff_per_24h * stay) + (s.harbour_tariff_min * stay);

  // Customs surveillance: daily * port stay.
  const customsSurv = stay * s.customs_surv_daily;

  // Agency fee (incl bank charges): base + per-day beyond the included days.
  const extraDays = Math.max(0, stay - s.agency_fee_included_days);
  const agencyFee = s.agency_fee_base + s.agency_fee_per_day * extraDays;

  const lines: DaLine[] = [
    { label: "Pilotage inwards", currency: "USD", amount: r2(pilotageUSD) },
    { label: "Pilotage outwards", currency: "USD", amount: r2(pilotageUSD) },
    { label: "Towage inwards", currency: "USD", amount: r2(towageUSD) },
    { label: "Towage outwards", currency: "USD", amount: r2(towageUSD) },
    { label: "Linesmen mooring", currency: "USD", amount: r2(linesmenUSD) },
    { label: "Linesmen unmooring", currency: "USD", amount: r2(linesmenUSD) },
    { label: "Wharfage dues", currency: "USD", amount: r2(wharfage) },
    { label: "Harbour dues", currency: "USD", amount: r2(harbour) },
    { label: "In/Outward custom clearance", currency: "USD", amount: r2(s.customs_clearance) },
    { label: "Customs surveillance", currency: "USD", amount: r2(customsSurv) },
    { label: "ISPS formalities / compliance", currency: "USD", amount: r2(s.isps_fee) },
    { label: "Agency fee (incl bank charges)", currency: "USD", amount: r2(agencyFee) },
  ];
  const total = r2(lines.reduce((a, l) => a + l.amount, 0));
  return { lines, total };
}
