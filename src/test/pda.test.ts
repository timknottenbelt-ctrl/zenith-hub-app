import { describe, it, expect } from "vitest";
import {
  assignTerminal,
  tugCount,
  portStay,
  calculatePda,
  type PdaConfig,
} from "../../supabase/functions/_shared/pda.ts";

// The PDA engine is the deterministic financial core (terminal assignment, tug
// count, port stay) ported from the n8n code nodes. These lock its behaviour so
// a refactor can't silently change a quotation. Expected values are read off the
// implementation, not guessed.

const EMPTY: PdaConfig = { tugRules: [], loadingRates: [], terminalAssignments: [] };

describe("tugCount", () => {
  it("cargo discharge always takes LOA-based tugs (≥169m → 2)", () => {
    expect(tugCount(180, "WILLEMSTAD", "discharge", [])).toBe(2);
  });
  it("cargo under 169m → 1 tug", () => {
    expect(tugCount(150, "WILLEMSTAD", "loading", [])).toBe(1);
  });
  it("offshore SERVICE (not cargo) → 0 tugs", () => {
    expect(tugCount(100, "OFFSHORE_CURACAO", "crew change", [])).toBe(0);
  });
  it("offshore STS → LOA-based (≤200 → 1, >200 → 2)", () => {
    expect(tugCount(150, "OFFSHORE_CURACAO", "sts", [])).toBe(1);
    expect(tugCount(210, "OFFSHORE_CURACAO", "sts", [])).toBe(2);
  });
  it("a matching tug rule overrides the fallback (max tug_count wins)", () => {
    const rules = [{ port_code: "WILLEMSTAD", loa_min: 0, loa_max: 300, tug_count: 3 }];
    expect(tugCount(180, "WILLEMSTAD", "loading", rules)).toBe(3);
  });
});

describe("portStay", () => {
  it("no loading rate → default 1000 MT/day", () => {
    expect(portStay(6000, "discharge", "ISLA", "bitumen", [])).toEqual({ port_stay: 6, loading_rate: 1000 });
  });
  it("uses the matching discharge rate when present", () => {
    const rates = [{ cargo_type: "bitumen", loading_rate: 3000, discharge_rate: 2000 }];
    expect(portStay(6000, "discharge", "ISLA", "bitumen", rates)).toEqual({ port_stay: 3, loading_rate: 2000 });
  });
  it("offshore adds a 20% buffer", () => {
    // 5000 / 1000 = 5 days, ×1.2 = 6
    expect(portStay(5000, "loading", "OFFSHORE_X", "grain", []).port_stay).toBe(6);
  });
  it("never rounds a real call below 0.5 days", () => {
    expect(portStay(0, "crew change", "WILLEMSTAD", "", []).port_stay).toBe(0.5);
  });
});

describe("assignTerminal", () => {
  it("falls back for cargo when no terminal config matches", () => {
    const r = assignTerminal({ cargo_type: "bitumen", operation_type: "discharge", loa: 180 }, []);
    expect(r.terminal).toBe("Offshore");
    expect(r.area).toBe("Outer Bays");
  });
  it("routes mid-size bunkering to Prins Hendrikkade", () => {
    expect(assignTerminal({ operation_type: "bunkering", loa: 150 }, []).terminal).toBe("Prins Hendrikkade");
  });
  it("routes very large vessels offshore", () => {
    expect(assignTerminal({ operation_type: "discharge", loa: 250 }, []).port_code).toBe("OFFSHORE_CURACAO");
  });
  it("uses a matching Supabase terminal assignment when provided", () => {
    const terms = [{ cargo_type: "bitumen", loa_min: 0, loa_max: 300, terminal_name: "ISLA Refinery", facility_name: "Berth 1", port_code: "ISLA", area_name: "Willemstad", priority: 1 }];
    const r = assignTerminal({ cargo_type: "bitumen", operation_type: "discharge", loa: 180 }, terms);
    expect(r.terminal).toBe("ISLA Refinery");
  });
});

describe("calculatePda (integration)", () => {
  it("combines terminal → tugs → port stay for a cargo call", () => {
    const r = calculatePda(
      { name: "MV Test", loa: 180, operation_type: "discharge", cargo_type: "bitumen", cargo_quantity: 6000 },
      EMPTY,
    );
    expect(r.tugs).toBe(2);
    expect(r.port_stay).toBe(6);
    expect(r.terminal).toBe("Offshore");
  });
});
