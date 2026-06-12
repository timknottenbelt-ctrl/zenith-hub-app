// Deterministic PDA (Port Disbursement Account) calculation engine.
// Ported verbatim from the n8n "Dashboard PDA creator" code nodes
// (Tug Calculator1, Port Stay Calculator1, Terminal Assignment1) so the logic
// is finally visible, testable and version-controlled instead of buried in n8n.
//
// Config rows come straight from the Supabase tables tug_rules / loading_rates /
// terminal_assignments. Field names match those tables.

// Config-row shapes (subset of the Supabase tables actually read here).
export interface TugRuleRow {
  port_code?: string | null;
  loa_min?: number | string | null;
  loa_max?: number | string | null;
  tug_count?: number;
  operation_types?: string[] | null;
}
export interface LoadingRateRow {
  cargo_type?: string | null;
  loading_rate?: number;
  discharge_rate?: number | null;
  heating_required?: boolean | null;
  heating_buffer_percent?: number | null;
  port_stay_buffer_percent?: number | null;
}
export interface TerminalAssignmentRow {
  cargo_type?: string | null;
  loa_min?: number | string | null;
  loa_max?: number | string | null;
  priority?: number | null;
  terminal_name?: string | null;
  facility_name?: string | null;
  port_code?: string | null;
  area_name?: string | null;
}

export interface PdaConfig {
  tugRules: TugRuleRow[];
  loadingRates: LoadingRateRow[];
  terminalAssignments: TerminalAssignmentRow[];
}

export interface VesselInput {
  name?: string;
  loa?: number;
  grt?: number;
  dwt?: number;
  operation_type?: string;
  cargo_type?: string;
  cargo_quantity?: number;
}

export interface PdaResult {
  vessel_name?: string;
  loa?: number;
  operation_type?: string;
  cargo_type?: string;
  cargo_quantity?: number;
  port_code: string | null;
  terminal: string | null;
  facility: string | null;
  area: string | null;
  tugs: number;
  port_stay: number | null;
  loading_rate: number | null;
}

// ── Terminal Assignment (from Terminal Assignment1) ──
export function assignTerminal(vessel: VesselInput, terminalAssignments: TerminalAssignmentRow[]) {
  const cargoType = (vessel.cargo_type || "").toLowerCase();
  const operation = (vessel.operation_type || "").toLowerCase();
  const loa = vessel.loa || 0;

  let terminal: string | null = null;
  let facility: string | null = null;
  let port_code: string | null = null;
  let area: string | null = null;

  // === TRY SUPABASE MATCH FIRST (for load/discharge) ===
  if (terminalAssignments.length > 0 && (operation.includes("load") || operation.includes("discharge"))) {
    const matches = terminalAssignments
      .filter((ta) => {
        const taCargo = (ta.cargo_type || "").toLowerCase();
        const loaMin = parseFloat(ta.loa_min) || 0;
        const loaMax = parseFloat(ta.loa_max) || 9999;
        const cargoMatch = cargoType.includes(taCargo) || taCargo.includes(cargoType);
        const loaMatch = loa >= loaMin && loa <= loaMax;
        return cargoMatch && loaMatch;
      })
      .sort((a, b) => (a.priority || 99) - (b.priority || 99));

    if (matches.length > 0) {
      const match = matches[0];
      terminal = match.terminal_name;
      facility = match.facility_name;
      port_code = match.port_code;
      area = match.area_name;
    }
  }

  // === FALLBACK: VERY LARGE VESSELS (LOA >220m) ===
  if (!terminal && loa > 220) {
    port_code = "OFFSHORE_CURACAO";
    terminal = "Offshore / St. Michiel's Bay";
    facility = "Deep Water Anchorage";
    area = "Offshore";
    if (operation.includes("bunker")) facility = "Bunkering via Barge";
    else if (operation.includes("sts") || operation.includes("ship-to-ship")) facility = "STS Operations";
    else if (operation.includes("crew") || operation.includes("change")) facility = "Launch Boat Service";
    else facility = "Offshore Services via Barge";
  }

  // === FALLBACK: BUNKERING ===
  if (!terminal && operation.includes("bunker")) {
    if (loa >= 190) {
      port_code = "WILLEMSTAD_OUTER_BAYS"; terminal = "Offshore"; facility = "Anchorage Bunkering via Barge"; area = "Outer Bays";
    } else if (loa > 130) {
      port_code = "WILLEMSTAD_PHK"; terminal = "Prins Hendrikkade"; facility = "PHK Outer Berth"; area = "Willemstad";
    } else {
      port_code = "WILLEMSTAD_MOTET"; terminal = "Motet Nieuwe Wharf"; facility = "Inner Berth"; area = "Willemstad Inner";
    }
  }

  // === FALLBACK: STS ===
  if (!terminal && (operation.includes("sts") || operation.includes("ship-to-ship"))) {
    port_code = "STS_ZONE_CURACAO"; terminal = "STS Zone"; facility = "Offshore Transfer"; area = "STS Area";
  }

  // === FALLBACK: REPAIR ===
  if (!terminal && (operation.includes("repair") || operation.includes("maintenance") || operation.includes("damen"))) {
    if (loa < 190) { port_code = "DAMEN_SHIPREPAIR_CURACAO"; terminal = "Damen Shipyard"; facility = "Repair Berth"; area = "Willemstad Inner"; }
    else if (loa <= 220) { port_code = "CARACAS_BAY"; terminal = "Caracas Bay"; facility = "Repair Berth"; area = "Caracas Bay"; }
    else { port_code = "ST_MICHIELS_BAY"; terminal = "St. Michiel's Bay"; facility = "Mooring Buoy"; area = "St. Michiel's Bay"; }
  }

  // === ULTIMATE FALLBACK ===
  if (!terminal) {
    if (loa > 220) { port_code = "OFFSHORE_CURACAO"; terminal = "Offshore"; facility = "Deep Water Anchorage"; area = "Offshore"; }
    else { port_code = "WILLEMSTAD_OUTER_BAYS"; terminal = "Offshore"; facility = "Anchorage"; area = "Outer Bays"; }
  }

  return { port_code, terminal, facility, area };
}

// ── Tug Calculator (from Tug Calculator1) ──
export function tugCount(loa: number, portCode: string, operationType: string, tugRules: TugRuleRow[]): number {
  const operation = (operationType || "").toLowerCase();
  let tugs = 0;

  const matchingRules = tugRules.filter((tr) => {
    const trPort = (tr.port_code || "").toLowerCase();
    const currentPort = (portCode || "").toLowerCase();
    const loaMin = parseFloat(tr.loa_min) || 0;
    const loaMax = parseFloat(tr.loa_max) || 9999;
    const portMatch = currentPort === trPort || currentPort.includes(trPort) || trPort.includes(currentPort);
    const loaMatch = loa >= loaMin && loa <= loaMax;
    let opMatch = true;
    if (tr.operation_types && tr.operation_types.length > 0) {
      opMatch = tr.operation_types.some((ot: string) => operation.includes(ot.toLowerCase()));
    }
    return portMatch && loaMatch && opMatch;
  });

  if (matchingRules.length > 0) {
    tugs = Math.max(...matchingRules.map((r) => r.tug_count));
  } else {
    // Cargo agent in Curacao ALWAYS berths to load/discharge — so a loading or
    // discharging call always takes tugs (LOA-based), never 0, even if the port
    // code looks offshore/anchorage. Only true offshore/anchorage SERVICES take 0.
    const isCargo = operation.includes("load") || operation.includes("discharg");
    if (!isCargo && (portCode.includes("OFFSHORE") || portCode.includes("ST_MICHIELS"))) {
      tugs = (operation.includes("sts") || operation.includes("ship-to-ship")) ? (loa > 200 ? 2 : 1) : 0;
    } else if (!isCargo && portCode.includes("OUTER_BAYS")) {
      tugs = 0;
    } else if (loa >= 169) {
      tugs = 2;
    } else if (loa > 0) {
      tugs = 1;
    }
  }
  return tugs;
}

// ── Port Stay Calculator (from Port Stay Calculator1) ──
export function portStay(
  cargoQty: number, operationType: string, portCode: string, cargoType: string, loadingRates: LoadingRateRow[],
): { port_stay: number | null; loading_rate: number | null } {
  const operation = (operationType || "").toLowerCase();
  const cargo = (cargoType || "").toLowerCase();
  let port_stay: number | null = null;
  let loading_rate: number | null = null;

  if ((operation.includes("load") || operation.includes("discharge")) && cargoQty > 0) {
    const matchingRate = loadingRates.find((lr) => {
      const lrCargo = (lr.cargo_type || "").toLowerCase();
      return cargo.includes(lrCargo) || lrCargo.includes(cargo);
    });

    if (matchingRate) {
      loading_rate = operation.includes("discharge")
        ? (matchingRate.discharge_rate || matchingRate.loading_rate)
        : matchingRate.loading_rate;
      port_stay = cargoQty / loading_rate!;
      if (matchingRate.heating_required && matchingRate.heating_buffer_percent > 0) {
        port_stay = port_stay * (1 + matchingRate.heating_buffer_percent / 100);
      }
      if (matchingRate.port_stay_buffer_percent > 0) {
        port_stay = port_stay * (1 + matchingRate.port_stay_buffer_percent / 100);
      }
    } else {
      loading_rate = 1000;
      port_stay = cargoQty / loading_rate;
    }
    if (portCode.includes("OFFSHORE")) port_stay = port_stay * 1.2;
    port_stay = Math.round(port_stay * 2) / 2;
  } else if (operation.includes("bunker") && cargoQty > 0) {
    const rate = portCode.includes("OFFSHORE") || portCode.includes("OUTER_BAYS") ? 150 : 250;
    port_stay = Math.round(((cargoQty / rate) + 2) / 24 * 1.2 * 2) / 2;
  } else if (operation.includes("sts") || operation.includes("ship-to-ship")) {
    port_stay = cargoQty > 0 ? Math.ceil(((cargoQty / 1200) + 0.5) * 1.3 * 2) / 2 : 1;
  } else if (operation.includes("crew") || operation.includes("provision")) {
    port_stay = 0.5;
  } else {
    port_stay = 1;
  }
  // Never let a real call round down to 0 days (that zeroed wharfage/harbour/customs).
  if (port_stay !== null && port_stay < 0.5) port_stay = 0.5;
  return { port_stay, loading_rate };
}

// ── Orchestrator: terminal → tugs → port stay (n8n flow order) ──
export function calculatePda(vessel: VesselInput, config: PdaConfig): PdaResult {
  const loa = vessel.loa || 0;
  const { port_code, terminal, facility, area } = assignTerminal(vessel, config.terminalAssignments);
  const tugs = tugCount(loa, port_code || "", vessel.operation_type || "", config.tugRules);
  const { port_stay, loading_rate } = portStay(
    vessel.cargo_quantity || 0, vessel.operation_type || "", port_code || "", vessel.cargo_type || "", config.loadingRates,
  );

  return {
    vessel_name: vessel.name,
    loa: vessel.loa,
    operation_type: vessel.operation_type,
    cargo_type: vessel.cargo_type,
    cargo_quantity: vessel.cargo_quantity,
    port_code, terminal, facility, area,
    tugs, port_stay, loading_rate,
  };
}
