import { ServiceType } from '../providers/provider.types';

type PlaceEntry = {
  name: string;
  aliases?: string[];
  /** Railway station code */
  station?: string;
  /** IATA airport code */
  airport?: string;
};

/**
 * Small, extensible alias table. Anything not listed still works: the place is
 * title-cased and passed to providers as free text.
 */
const PLACES: PlaceEntry[] = [
  { name: 'Vadodara', aliases: ['baroda', 'vadodra'], station: 'BRC', airport: 'BDQ' },
  { name: 'Mumbai', aliases: ['bombay', 'mumbai central', 'bandra'], station: 'MMCT', airport: 'BOM' },
  { name: 'Delhi', aliases: ['new delhi', 'nd', 'ncr'], station: 'NDLS', airport: 'DEL' },
  { name: 'Ahmedabad', aliases: ['amdavad', 'ahmadabad'], station: 'ADI', airport: 'AMD' },
  { name: 'Surat', station: 'ST', airport: 'STV' },
  { name: 'Pune', aliases: ['poona'], station: 'PUNE', airport: 'PNQ' },
  { name: 'Bengaluru', aliases: ['bangalore', 'blr'], station: 'SBC', airport: 'BLR' },
  { name: 'Chennai', aliases: ['madras'], station: 'MAS', airport: 'MAA' },
  { name: 'Kolkata', aliases: ['calcutta'], station: 'HWH', airport: 'CCU' },
  { name: 'Hyderabad', aliases: ['secunderabad'], station: 'SC', airport: 'HYD' },
  { name: 'Jaipur', station: 'JP', airport: 'JAI' },
  { name: 'Lucknow', station: 'LKO', airport: 'LKO' },
  { name: 'Bhopal', station: 'BPL', airport: 'BHO' },
  { name: 'Indore', station: 'INDB', airport: 'IDR' },
  { name: 'Nagpur', station: 'NGP', airport: 'NAG' },
  { name: 'Goa', aliases: ['madgaon', 'margao', 'panaji', 'panjim'], station: 'MAO', airport: 'GOI' },
  { name: 'Kochi', aliases: ['cochin', 'ernakulam'], station: 'ERS', airport: 'COK' },
  { name: 'Thiruvananthapuram', aliases: ['trivandrum'], station: 'TVC', airport: 'TRV' },
  { name: 'Chandigarh', station: 'CDG', airport: 'IXC' },
  { name: 'Amritsar', station: 'ASR', airport: 'ATQ' },
  { name: 'Patna', station: 'PNBE', airport: 'PAT' },
  { name: 'Varanasi', aliases: ['banaras', 'benares', 'kashi'], station: 'BSB', airport: 'VNS' },
  { name: 'Agra', station: 'AGC', airport: 'AGR' },
  { name: 'Kanpur', station: 'CNB', airport: 'KNU' },
  { name: 'Rajkot', station: 'RJT', airport: 'RAJ' },
  { name: 'Udaipur', station: 'UDZ', airport: 'UDR' },
  { name: 'Jodhpur', station: 'JU', airport: 'JDH' },
  { name: 'Visakhapatnam', aliases: ['vizag'], station: 'VSKP', airport: 'VTZ' },
  { name: 'Coimbatore', station: 'CBE', airport: 'CJB' },
  { name: 'Mysuru', aliases: ['mysore'], station: 'MYS', airport: 'MYQ' },
  { name: 'Guwahati', station: 'GHY', airport: 'GAU' },
  { name: 'Bhubaneswar', station: 'BBS', airport: 'BBI' },
  { name: 'Ranchi', station: 'RNC', airport: 'IXR' },
  { name: 'Raipur', station: 'R', airport: 'RPR' },
  { name: 'Dehradun', station: 'DDN', airport: 'DED' },
  { name: 'Shimla', station: 'SML', airport: 'SLV' },
  { name: 'Srinagar', airport: 'SXR' },
  { name: 'Jammu', station: 'JAT', airport: 'IXJ' },
  { name: 'Nashik', aliases: ['nasik'], station: 'NK', airport: 'ISK' },
  { name: 'Aurangabad', station: 'AWB', airport: 'IXU' },
  { name: 'Bhavnagar', station: 'BVC', airport: 'BHU' },
  { name: 'Jamnagar', station: 'JAM', airport: 'JGA' },
  { name: 'Gandhinagar', station: 'GNC' },
  { name: 'Anand', station: 'ANND' },
  { name: 'Bharuch', station: 'BH' },
  { name: 'Navsari', station: 'NVS' },
  { name: 'Vapi', station: 'BL' },
  { name: 'Madurai', station: 'MDU', airport: 'IXM' },
  { name: 'Tirupati', station: 'TPTY', airport: 'TIR' },
  { name: 'Vijayawada', station: 'BZA', airport: 'VGA' },
  { name: 'Mangaluru', aliases: ['mangalore'], station: 'MAQ', airport: 'IXE' },
  { name: 'Kozhikode', aliases: ['calicut'], station: 'CLT', airport: 'CCJ' },
  { name: 'Leh', airport: 'IXL' },
  { name: 'Port Blair', airport: 'IXZ' },
];

const INDEX = new Map<string, PlaceEntry>();
for (const entry of PLACES) {
  INDEX.set(entry.name.toLowerCase(), entry);
  for (const alias of entry.aliases ?? []) {
    INDEX.set(alias.toLowerCase(), entry);
  }
}

export type ResolvedPlace = {
  /** Display name, e.g. "Vadodara" */
  name: string;
  /** Code sent to a provider for the given service type */
  code: string;
};

export function titleCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

/** Normalises a free-text place into its canonical display name. */
export function canonicalPlaceName(text: string): string {
  const key = text.trim().toLowerCase().replace(/\s+/g, ' ');
  return INDEX.get(key)?.name ?? titleCase(text);
}

export function resolvePlace(text: string, serviceType: ServiceType): ResolvedPlace {
  const key = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const entry = INDEX.get(key);
  const name = entry?.name ?? titleCase(text);
  if (!entry) {
    return { name, code: name };
  }
  if (serviceType === 'TRAIN') {
    return { name, code: entry.station ?? name };
  }
  if (serviceType === 'FLIGHT') {
    return { name, code: entry.airport ?? name };
  }
  return { name, code: name };
}

// ---- approximate coordinates (lat, lon) so mock timetables get realistic distances/durations
const COORDS: Record<string, [number, number]> = {
  vadodara: [22.31, 73.18], mumbai: [19.08, 72.88], delhi: [28.61, 77.21], ahmedabad: [23.02, 72.57],
  surat: [21.17, 72.83], pune: [18.52, 73.86], bengaluru: [12.97, 77.59], chennai: [13.08, 80.27],
  kolkata: [22.57, 88.36], hyderabad: [17.39, 78.49], jaipur: [26.91, 75.79], lucknow: [26.85, 80.95],
  bhopal: [23.26, 77.41], indore: [22.72, 75.86], nagpur: [21.15, 79.09], goa: [15.3, 74.12],
  kochi: [9.93, 76.27], thiruvananthapuram: [8.52, 76.94], chandigarh: [30.73, 76.78], amritsar: [31.63, 74.87],
  patna: [25.59, 85.14], varanasi: [25.32, 83.01], agra: [27.18, 78.01], kanpur: [26.45, 80.35],
  rajkot: [22.3, 70.8], udaipur: [24.58, 73.68], jodhpur: [26.24, 73.02], visakhapatnam: [17.69, 83.22],
  coimbatore: [11.02, 76.96], mysuru: [12.3, 76.64], guwahati: [26.14, 91.74], bhubaneswar: [20.3, 85.82],
  ranchi: [23.34, 85.31], raipur: [21.25, 81.63], dehradun: [30.32, 78.03], shimla: [31.1, 77.17],
  srinagar: [34.08, 74.8], jammu: [32.73, 74.86], nashik: [19.99, 73.79], aurangabad: [19.88, 75.34],
  bhavnagar: [21.76, 72.15], jamnagar: [22.47, 70.06], gandhinagar: [23.22, 72.65], anand: [22.56, 72.95],
  bharuch: [21.71, 72.99], navsari: [20.95, 72.93], vapi: [20.37, 72.91], madurai: [9.93, 78.12],
  tirupati: [13.63, 79.42], vijayawada: [16.51, 80.65], mangaluru: [12.91, 74.86], kozhikode: [11.26, 75.78],
  leh: [34.15, 77.58], 'port blair': [11.62, 92.73],
};

const CODE_TO_NAME = new Map<string, string>();
for (const entry of PLACES) {
  if (entry.station) CODE_TO_NAME.set(entry.station.toLowerCase(), entry.name.toLowerCase());
  if (entry.airport) CODE_TO_NAME.set(entry.airport.toLowerCase(), entry.name.toLowerCase());
}

function coordsOf(place: string): [number, number] | undefined {
  const key = place.trim().toLowerCase().replace(/\s+/g, ' ');
  const name = INDEX.get(key)?.name.toLowerCase() ?? CODE_TO_NAME.get(key) ?? key;
  return COORDS[name];
}

/** Great-circle distance in km between two known places (by name or station/airport code). */
export function knownDistanceKm(a: string, b: string): number | null {
  const from = coordsOf(a);
  const to = coordsOf(b);
  if (!from || !to) return null;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(to[0] - from[0]);
  const dLon = rad(to[1] - from[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(from[0])) * Math.cos(rad(to[0])) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
