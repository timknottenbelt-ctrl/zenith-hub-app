// Curaçao terminal reference database + berth-feasibility check.
//
// Data verified against the Curaçao Ports Authority and agency port directories.
// Limit semantics matter for the check:
//   - a numeric value          = a real published limit
//   - null                     = unknown / not published (no warning, shown as "—")
//   - noLoaLimit: true         = explicitly NO LOA limit (Bullen Bay), not unknown
//   - airDraftM null           = no overhead restriction (terminal is outside the bay)
//   - airDraftM number         = Julianabrug clearance applies (inner harbour / Schottegat)

export interface Terminal {
  name: string;
  aliases: string[];
  lat: number;
  lon: number;
  maxLoaM: number | null;
  maxDraftM: number | null;
  maxDwt: number | null;
  berthLengthM: number | null;
  airDraftM: number | null;
  berths: number | null;
  products: string[];
  nightBerthing: boolean;
  typicalTugs: number | null;
  mooringType: string;
  noLoaLimit?: boolean;
  notes: string;
}

export const TERMINALS: Terminal[] = [
  {
    name: 'Bullen Bay (Bullenbaai)',
    aliases: ['Bullenbaai', 'Curacao Oil Terminal', 'COT', 'ANBUB', 'bopec'],
    lat: 12.1918,
    lon: -69.0184,
    maxLoaM: null,
    noLoaLimit: true,
    maxDraftM: 28.7,
    maxDwt: 550000,
    berthLengthM: null,
    airDraftM: null,
    berths: 6,
    products: ['crude', 'products', 'fuel oil', 'bunkers'],
    nightBerthing: true,
    typicalTugs: 2,
    mooringType: 'jetty',
    notes: 'Crude/products transshipment. Geen LOA-limiet. Kleinste jetty ~70.000 DWT. Geen ankerage in baai. Bron: CPA.',
  },
  {
    name: 'Caracas Bay (Caracasbaai)',
    aliases: ['Caracasbaai', 'CWCRB'],
    lat: 12.0745,
    lon: -68.8565,
    maxLoaM: 320,
    maxDraftM: 13.7,
    maxDwt: null,
    berthLengthM: null,
    airDraftM: null,
    berths: 2,
    products: ['cruise', 'general cargo', 'inspection/repair', 'lay-by'],
    nightBerthing: true,
    typicalTugs: null,
    mooringType: 'alongside',
    notes: 'Voormalige Shell-olieterminal. Loods verplicht ≥50 GT. Geen bunker/opslag; brandstof per barge uit Willemstad. Bron: CPA.',
  },
  {
    name: 'Port of Willemstad / St. Anna Bay',
    aliases: ['Willemstad', 'Sint Anna Baai', 'St. Anna Bay', 'Punda', 'Otrobanda', 'CMC', 'CPA'],
    lat: 12.1083,
    lon: -68.9335,
    maxLoaM: 280,
    maxDraftM: 12.8,
    maxDwt: null,
    berthLengthM: null,
    airDraftM: 56.4,
    berths: null,
    products: ['general cargo', 'bunkers', 'passenger'],
    nightBerthing: true,
    typicalTugs: null,
    mooringType: 'alongside',
    notes: 'Entreekanaal min. 15,2m diep. Emmabrug (ponton) opent dag/nacht; Julianabrug (vast) doorvaarthoogte 56,4m beperkt Schottegat-toegang. Schepen tot 13,7m draft in overleg. Bron: CPA.',
  },
  {
    name: 'Isla / Emmastad Refinery (Schottegat)',
    aliases: ['Isla', 'Emmastad', 'Asiento', 'Isla Jetties', 'Refineria di Korsou', 'refiner', 'rdf'],
    lat: 12.1345,
    lon: -68.9331,
    maxLoaM: 259,
    maxDraftM: 13.71,
    maxDwt: 100000,
    berthLengthM: 259,
    airDraftM: 56.4,
    berths: 10,
    products: ['crude', 'fuel oil', 'bitumen', 'gasoil', 'mogas', 'naphtha', 'white oils', 'LPG', 'chemicals', 'bunkers'],
    nightBerthing: true,
    typicalTugs: null,
    mooringType: 'jetty',
    notes: '10 jetties, per-jetty draft 6,4–13,71m / LOA 170–259m. Diepste: jetty 5 & 8 (13,71m, 259m); jetty 6 bitumen op 11,43m. Air draft via Julianabrug 56,4m. Ceiling = diepste jetty. Bron: CPA.',
  },
  {
    name: 'Motet Wharf (CRU / Curoil)',
    aliases: ['Motet', 'CRU', 'Motet Steiger', 'Curoil', 'cru'],
    lat: 12.1359,
    lon: -68.9189,
    maxLoaM: null,
    maxDraftM: null,
    maxDwt: null,
    berthLengthM: null,
    airDraftM: 56.4,
    berths: null,
    products: ['bunkers', 'fuel oil', 'gasoil'],
    nightBerthing: true,
    typicalTugs: null,
    mooringType: 'jetty',
    notes: 'Curoil-bunkerwharf; pijpleiding ~2km naar Mega Pier. Exacte LOA/draft niet publiek — verifieer bij CPA/loodsen. Bron: CPA.',
  },
  {
    name: 'Container Terminal (Schottegat)',
    aliases: ['CPA Container Terminal', 'Schottegat container quay', 'container'],
    lat: 12.123,
    lon: -68.921,
    maxLoaM: null,
    maxDraftM: 12.2,
    maxDwt: null,
    berthLengthM: 460,
    airDraftM: 56.4,
    berths: null,
    products: ['containers', 'Ro/Ro'],
    nightBerthing: true,
    typicalTugs: null,
    mooringType: 'alongside',
    notes: '~1000m totale kade, max berth 460m, diepte 12,2m. 2 gantry cranes, 24u. Air draft via Julianabrug 56,4m. Bron: CPA.',
  },
  {
    name: 'Mega Pier 1',
    aliases: ['Megapier 1', 'Mega Cruise Pier I', 'mega pier', 'megapier'],
    lat: 12.1044,
    lon: -68.9418,
    maxLoaM: null,
    maxDraftM: 16.0,
    maxDwt: null,
    berthLengthM: 150,
    airDraftM: null,
    berths: 1,
    products: ['cruise', 'offshore/rig mob', 'large vessels'],
    nightBerthing: true,
    typicalTugs: null,
    mooringType: 'jetty',
    notes: 'Max GT 150.000; draft 16m; jetty 150m. Buiten St. Anna Bay = geen air draft-limiet. Ook rig-mob/demob. Bron: CPA.',
  },
  {
    name: 'Mega Pier 2',
    aliases: ['Megapier 2', 'Mega Cruise Pier II'],
    lat: 12.104,
    lon: -68.9422,
    maxLoaM: null,
    maxDraftM: 20.0,
    maxDwt: null,
    berthLengthM: 196,
    airDraftM: null,
    berths: 1,
    products: ['cruise', 'large vessels'],
    nightBerthing: true,
    typicalTugs: null,
    mooringType: 'jetty',
    notes: 'Max GT 225.000; draft 20m; jetty 196m. Voltooid 2017, west van St. Anna Bay-entree. Bron: CPA.',
  },
  {
    name: 'Fuik Bay (Fuikbaai)',
    aliases: ['Fuikbaai', 'phosphate wharf', 'zandsteiger', 'fuik'],
    lat: 12.0563,
    lon: -68.8373,
    maxLoaM: null,
    maxDraftM: 6.7,
    maxDwt: null,
    berthLengthM: null,
    airDraftM: null,
    berths: 2,
    products: ['dry bulk', 'phosphate', 'explosives', 'general cargo'],
    nightBerthing: true,
    typicalTugs: null,
    mooringType: 'alongside',
    notes: 'Phosphate wharf met conveyor/laadtoren (150 tph). Zandsteiger 25,6m berth, diepte langszij 6,7m. Bron: CPA.',
  },
  {
    name: 'Sint Michielsbaai',
    aliases: ['Sint Michiel', 'St. Michiels', "St Michiel's Bay", 'michiel'],
    lat: 12.1474,
    lon: -68.9997,
    maxLoaM: null,
    maxDraftM: null,
    maxDwt: null,
    berthLengthM: null,
    airDraftM: null,
    berths: 1,
    products: ['underwater operations', 'lay-by', 'hull cleaning'],
    nightBerthing: true,
    typicalTugs: null,
    mooringType: 'SBM',
    notes: 'CPA single mooring buoy. Beschutte diepwaterbaai voor onderwater-ops/hull cleaning. Afmetingen niet publiek. Bron: CPA.',
  },
  {
    name: 'Schottegat Anchorage',
    aliases: ['Willemstad anchorage', 'Schottegat waiting berth', 'anchorage', 'outer'],
    lat: 12.118,
    lon: -68.94,
    maxLoaM: null,
    maxDraftM: 12.19,
    maxDwt: null,
    berthLengthM: null,
    airDraftM: 56.4,
    berths: null,
    products: [],
    nightBerthing: true,
    typicalTugs: null,
    mooringType: 'buoy',
    notes: 'Wachtplaats ZW-Schottegat, dolphins met mooring buoy (348m), diepte 12,19m. Toestemming havenmeester. GEEN ankerage in Bullen Bay. Bron: CPA.',
  },
];

/** Resolve a terminal/port free-text string against names + aliases. */
export function resolveTerminal(...candidates: (string | null | undefined)[]): Terminal | null {
  for (const c of candidates) {
    if (!c) continue;
    const low = c.toLowerCase();
    for (const t of TERMINALS) {
      if (t.name.toLowerCase().includes(low) || low.includes(t.name.toLowerCase())) return t;
      if (t.aliases.some((a) => low.includes(a.toLowerCase()))) return t;
    }
  }
  return null;
}

export type DimStatus = 'ok' | 'exceed' | 'unknown' | 'nolimit';

export interface BerthCheckRow {
  label: string;
  vesselVal: number | null;
  limitVal: number | null;
  unit: string;
  status: DimStatus;
  noteNoLimit?: boolean;
}

export interface BerthCheckResult {
  verdict: 'fits' | 'exceeds' | 'unknown';
  rows: BerthCheckRow[];
}

export interface VesselDims {
  loa?: number | null;
  draft?: number | null;
  dwt?: number | null;
  airDraft?: number | null;
}

function dimStatus(vessel: number | null | undefined, limit: number | null, noLimit?: boolean): DimStatus {
  if (noLimit) return 'nolimit';
  if (limit == null) return 'unknown';
  if (vessel == null || !(vessel > 0)) return 'unknown';
  return vessel > limit ? 'exceed' : 'ok';
}

/** Compare a vessel's dimensions against a terminal's published limits. */
export function berthCheck(vessel: VesselDims, t: Terminal): BerthCheckResult {
  const rows: BerthCheckRow[] = [
    { label: 'LOA', vesselVal: vessel.loa ?? null, limitVal: t.maxLoaM, unit: 'm', status: dimStatus(vessel.loa, t.maxLoaM, t.noLoaLimit), noteNoLimit: t.noLoaLimit },
    { label: 'Draft', vesselVal: vessel.draft ?? null, limitVal: t.maxDraftM, unit: 'm', status: dimStatus(vessel.draft, t.maxDraftM) },
    { label: 'DWT', vesselVal: vessel.dwt ?? null, limitVal: t.maxDwt, unit: 'MT', status: dimStatus(vessel.dwt, t.maxDwt) },
    { label: 'Air draft', vesselVal: vessel.airDraft ?? null, limitVal: t.airDraftM, unit: 'm', status: dimStatus(vessel.airDraft, t.airDraftM) },
  ];
  const verdict: BerthCheckResult['verdict'] = rows.some((r) => r.status === 'exceed')
    ? 'exceeds'
    : rows.some((r) => r.status === 'ok' || r.status === 'nolimit')
      ? 'fits'
      : 'unknown';
  return { verdict, rows };
}
