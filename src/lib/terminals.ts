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
  parent?: string; // set on sub-berths (e.g. Isla jetties → the refinery record)
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

  // --- Isla / Emmastad refinery, per-jetty (parent = the aggregate record above) ---
  {
    name: 'Isla Jetty 1', aliases: ['Emmastad Jetty 1', 'Isla Jetty 1'], parent: 'Isla / Emmastad Refinery (Schottegat)',
    lat: 12.1345, lon: -68.9331, maxLoaM: 177, maxDraftM: 8.23, maxDwt: null, berthLengthM: 177, airDraftM: 56.4, berths: 1,
    products: ['gasoil', 'mogas', 'avtur', 'chemicals'], nightBerthing: true, typicalTugs: null, mooringType: 'jetty',
    notes: 'Producten: ballast, mogas, gasoil, avtur, zwavelzuur, MEK, tolueen, furfural, spent soda. Bron: CPA / agency directory.',
  },
  {
    name: 'Isla Jetty 2', aliases: ['Emmastad Jetty 2', 'Isla Jetty 2'], parent: 'Isla / Emmastad Refinery (Schottegat)',
    lat: 12.1345, lon: -68.9331, maxLoaM: 175, maxDraftM: 9.14, maxDwt: null, berthLengthM: 175, airDraftM: 56.4, berths: 1,
    products: ['bunkers', 'gasoil', 'mogas', 'avtur', 'naphtha', 'avgas', 'white oils', 'LPG', 'chemicals'], nightBerthing: true, typicalTugs: null, mooringType: 'jetty',
    notes: 'Draft fwd 9,14m / aft 9,60m → conservatief 9,14m. Incl. propaan/butaan/isobutaan, caustic soda. Bron: CPA / agency directory.',
  },
  {
    name: 'Isla Jetty 3', aliases: ['Emmastad Jetty 3', 'Isla Jetty 3'], parent: 'Isla / Emmastad Refinery (Schottegat)',
    lat: 12.1345, lon: -68.9331, maxLoaM: 175, maxDraftM: 9.3, maxDwt: null, berthLengthM: 175, airDraftM: 56.4, berths: 1,
    products: [], nightBerthing: true, typicalTugs: null, mooringType: 'jetty',
    notes: 'Producten niet publiek — bevestigen bij CPA. Bron: CPA / agency directory.',
  },
  {
    name: 'Isla Jetty 4', aliases: ['Emmastad Jetty 4', 'Isla Jetty 4'], parent: 'Isla / Emmastad Refinery (Schottegat)',
    lat: 12.1345, lon: -68.9331, maxLoaM: 236, maxDraftM: 11.58, maxDwt: null, berthLengthM: 236, airDraftM: 56.4, berths: 1,
    products: ['bunkers', 'gasoil', 'mogas', 'avtur', 'naphtha', 'avgas', 'white oils'], nightBerthing: true, typicalTugs: null, mooringType: 'jetty',
    notes: 'Incl. CatCracker feed. Bron: CPA / agency directory.',
  },
  {
    name: 'Isla Jetty 5', aliases: ['Emmastad Jetty 5', 'Isla Jetty 5'], parent: 'Isla / Emmastad Refinery (Schottegat)',
    lat: 12.1345, lon: -68.9331, maxLoaM: 259, maxDraftM: 13.71, maxDwt: null, berthLengthM: 259, airDraftM: 56.4, berths: 1,
    products: ['crude', 'heavy crude', 'fuel oil', 'bunkers', 'gasoil', 'mogas', 'avtur', 'naphtha', 'white oils'], nightBerthing: true, typicalTugs: null, mooringType: 'jetty',
    notes: 'Diepste jetty. Incl. Lt/Med crude, Long Residue, CatCracker feed. Bron: CPA / agency directory.',
  },
  {
    name: 'Isla Jetty 6', aliases: ['Emmastad Jetty 6', 'Isla Jetty 6'], parent: 'Isla / Emmastad Refinery (Schottegat)',
    lat: 12.1345, lon: -68.9331, maxLoaM: 228, maxDraftM: 11.43, maxDwt: null, berthLengthM: 228, airDraftM: 56.4, berths: 1,
    products: ['crude', 'heavy crude', 'fuel oil', 'bitumen', 'bunkers', 'gasoil', 'mogas', 'avtur', 'naphtha', 'white oils'], nightBerthing: true, typicalTugs: null, mooringType: 'jetty',
    notes: 'BITUMEN + crude/fuel oil op 11,43m draft. Incl. Lt/Med crude, Long Residue, CatCracker feed. Bron: CPA / agency directory.',
  },
  {
    name: 'Isla Jetty 7', aliases: ['Emmastad Jetty 7', 'Isla Jetty 7'], parent: 'Isla / Emmastad Refinery (Schottegat)',
    lat: 12.1345, lon: -68.9331, maxLoaM: 170, maxDraftM: 9.45, maxDwt: null, berthLengthM: 170, airDraftM: 56.4, berths: 1,
    products: ['crude', 'heavy crude', 'fuel oil', 'bitumen', 'bunkers', 'gasoil'], nightBerthing: true, typicalTugs: null, mooringType: 'jetty',
    notes: 'BITUMEN + crude/fuel oil maar ondieper (9,45m). Incl. Lt/Med crude, Long Residue. Bron: CPA / agency directory.',
  },
  {
    name: 'Isla Jetty 8', aliases: ['Emmastad Jetty 8', 'Isla Jetty 8'], parent: 'Isla / Emmastad Refinery (Schottegat)',
    lat: 12.1345, lon: -68.9331, maxLoaM: 259, maxDraftM: 13.71, maxDwt: null, berthLengthM: 259, airDraftM: 56.4, berths: 1,
    products: [], nightBerthing: true, typicalTugs: null, mooringType: 'jetty',
    notes: 'Diepste jetty (13,71m, 259m). Producten niet publiek; vermoedelijk crude/fuel oil-klasse zoals jetty 5 — bevestigen. Bron: CPA / agency directory.',
  },
  {
    name: 'Isla Jetty 9', aliases: ['Emmastad Jetty 9', 'Isla Jetty 9'], parent: 'Isla / Emmastad Refinery (Schottegat)',
    lat: 12.1345, lon: -68.9331, maxLoaM: 259, maxDraftM: 10.21, maxDwt: null, berthLengthM: 259, airDraftM: 56.4, berths: 1,
    products: [], nightBerthing: true, typicalTugs: null, mooringType: 'jetty',
    notes: 'Producten niet publiek — bevestigen bij CPA. Bron: CPA / agency directory.',
  },
  {
    name: 'Isla Jetty 10', aliases: ['Emmastad Jetty 10', 'Isla Jetty 10'], parent: 'Isla / Emmastad Refinery (Schottegat)',
    lat: 12.1345, lon: -68.9331, maxLoaM: 259, maxDraftM: 6.4, maxDwt: null, berthLengthM: 259, airDraftM: 56.4, berths: 1,
    products: [], nightBerthing: true, typicalTugs: null, mooringType: 'jetty',
    notes: 'Draft fwd 6,40m / aft 9,45m → conservatief 6,40m. Producten niet publiek — bevestigen bij CPA. Bron: CPA / agency directory.',
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

// Map a free-text cargo description (from the email) to a terminal product key.
const CARGO_PRODUCT_MAP: { match: RegExp; product: string }[] = [
  { match: /bitumen|asphalt|asfalt/i, product: 'bitumen' },
  { match: /crude/i, product: 'crude' },
  { match: /hfo|heavy fuel|fuel oil|stookolie|residue|ifo|vlsfo|lsfo/i, product: 'fuel oil' },
  { match: /gas\s?oil|gasoil|diesel|mgo|mdo/i, product: 'gasoil' },
  { match: /gasoline|mogas|petrol|benzine|naphtha/i, product: 'mogas' },
  { match: /jet|avtur|kerosene|avgas/i, product: 'avtur' },
  { match: /lpg|propane|butane|propaan|butaan/i, product: 'LPG' },
  { match: /container/i, product: 'containers' },
  { match: /phosphate|fosfaat|sand|zand|bulk/i, product: 'dry bulk' },
];

export function cargoToProduct(cargoType: string | null | undefined): string | null {
  if (!cargoType) return null;
  for (const { match, product } of CARGO_PRODUCT_MAP) if (match.test(cargoType)) return product;
  return null;
}

export interface BerthSuggestion {
  terminal: Terminal;
  productMatch: 'confirmed' | 'unconfirmed';
}

/** Rank berths that can take the cargo and fit the vessel. Excludes aggregate
 *  parent records when their individual sub-berths exist (jetties are more
 *  specific). Berths whose published products clearly exclude the cargo are
 *  dropped; berths with no published product list surface as "unconfirmed". */
export function suggestBerths(cargoType: string | null | undefined, dims: VesselDims): BerthSuggestion[] {
  const kw = cargoToProduct(cargoType);
  const parents = new Set(TERMINALS.filter((t) => t.parent).map((t) => t.parent));
  const out: BerthSuggestion[] = [];

  for (const t of TERMINALS) {
    if (parents.has(t.name)) continue; // skip the aggregate when sub-berths exist
    if (t.mooringType === 'buoy') continue; // anchorages aren't cargo berths
    // Drop berths that physically can't take the vessel.
    if (dims.draft != null && t.maxDraftM != null && dims.draft > t.maxDraftM) continue;
    if (dims.loa != null && t.maxLoaM != null && !t.noLoaLimit && dims.loa > t.maxLoaM) continue;

    let productMatch: 'confirmed' | 'unconfirmed';
    if (!kw) productMatch = 'unconfirmed';
    else if (t.products.length === 0) productMatch = 'unconfirmed';
    else if (t.products.some((p) => p.toLowerCase().includes(kw))) productMatch = 'confirmed';
    else continue; // products known and cargo not among them → not suitable

    out.push({ terminal: t, productMatch });
  }

  // Confirmed first; then the shallowest sufficient berth (reserve deep berths).
  out.sort((a, b) => {
    if (a.productMatch !== b.productMatch) return a.productMatch === 'confirmed' ? -1 : 1;
    return (a.terminal.maxDraftM ?? 99) - (b.terminal.maxDraftM ?? 99);
  });
  return out;
}
