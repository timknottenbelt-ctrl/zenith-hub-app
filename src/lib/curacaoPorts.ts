// Approximate coordinates for Curaçao terminals / anchorages, used to centre the
// port map on the dossier's berth. Good enough for a marker; not for navigation.

export interface PortLoc {
  name: string;
  lat: number;
  lon: number;
}

const LOCATIONS: { match: RegExp; loc: PortLoc }[] = [
  { match: /bullen|bullenbaai|bopec/i, loc: { name: 'Bullen Bay (Bullenbaai)', lat: 12.1989, lon: -68.989 } },
  { match: /caracas/i, loc: { name: 'Caracas Bay (Caracasbaai)', lat: 12.0668, lon: -68.8623 } },
  { match: /isla|emmastad|schottegat|refiner|cru|motet|rdf/i, loc: { name: 'Isla Refinery / Schottegat', lat: 12.1369, lon: -68.918 } },
  { match: /mega\s*pier|megapier|cruise/i, loc: { name: 'Mega Pier, Willemstad', lat: 12.1101, lon: -68.9402 } },
  { match: /fuik/i, loc: { name: 'Fuik Bay (Fuikbaai)', lat: 12.045, lon: -68.847 } },
  { match: /michiel/i, loc: { name: 'Sint Michiels Bay', lat: 12.1503, lon: -68.9852 } },
  { match: /outer|anchor|bay/i, loc: { name: 'Willemstad outer anchorage', lat: 12.09, lon: -68.95 } },
  { match: /willemstad|sint\s*anna|st\.?\s*anna|cmc|cpa|otrobanda|punda/i, loc: { name: 'Willemstad, Sint Anna Bay', lat: 12.1057, lon: -68.9335 } },
];

export const CURACAO_DEFAULT: PortLoc = { name: 'Curaçao', lat: 12.12, lon: -68.93 };

/** Resolve a terminal/port free-text string to a Curaçao location. */
export function resolvePortLoc(...candidates: (string | null | undefined)[]): PortLoc {
  for (const c of candidates) {
    if (!c) continue;
    for (const { match, loc } of LOCATIONS) if (match.test(c)) return loc;
  }
  return CURACAO_DEFAULT;
}

/** OpenStreetMap embed URL with a marker at the given location. */
export function osmEmbedUrl(loc: PortLoc, span = 0.06): string {
  const minLon = (loc.lon - span).toFixed(4);
  const minLat = (loc.lat - span / 2).toFixed(4);
  const maxLon = (loc.lon + span).toFixed(4);
  const maxLat = (loc.lat + span / 2).toFixed(4);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${loc.lat}%2C${loc.lon}`;
}

/** Live AIS tracking link (MarineTraffic) by IMO, falling back to a name search. */
export function marineTrafficUrl(imo: string | null | undefined, name: string | null | undefined): string {
  if (imo && /^\d{7}$/.test(imo.trim())) {
    return `https://www.marinetraffic.com/en/ais/details/ships/imo:${imo.trim()}`;
  }
  const q = encodeURIComponent((name || '').trim());
  return `https://www.marinetraffic.com/en/ais/index/search/all?keyword=${q}`;
}
