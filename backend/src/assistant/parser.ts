import { ServiceType } from '../providers/provider.types';
import { canonicalPlaceName } from './places';
import { Draft, Slot } from './slots';

/**
 * Deterministic, rule-based extraction of travel search slots from free text.
 * It never invents information: anything it cannot find stays undefined and the
 * assistant asks for it.
 */

const pad = (value: number) => String(value).padStart(2, '0');

const MONTH_RE =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
};

const monthNumber = (text: string) => MONTHS[text.slice(0, 3).toLowerCase()];

// ---------------------------------------------------------------- dates

export function toIso(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function todayIso(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function weekdayOf(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Picks this year, or next year if that date has already gone by. */
function inferYear(month: number, day: number, now: Date): string | null {
  const today = todayIso(now);
  const thisYear = toIso(now.getFullYear(), month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return toIso(now.getFullYear() + 1, month, day);
}

export type DateMatch = { iso: string; matched: string; strip: boolean };

export function extractDate(input: string, now: Date, lenient = false): DateMatch | null {
  let match: RegExpExecArray | null;

  match = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(input);
  if (match) {
    const iso = toIso(Number(match[1]), Number(match[2]), Number(match[3]));
    if (iso) return { iso, matched: match[0], strip: true };
  }

  match = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/.exec(input);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    const iso = toIso(year, Number(match[2]), Number(match[1]));
    if (iso) return { iso, matched: match[0], strip: true };
  }

  match = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTH_RE})\\b(?:\\s*,?\\s*(\\d{4}))?`, 'i').exec(input);
  if (match) {
    const month = monthNumber(match[2]);
    const iso = match[3] ? toIso(Number(match[3]), month, Number(match[1])) : inferYear(month, Number(match[1]), now);
    if (iso) return { iso, matched: match[0], strip: true };
  }

  match = new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(\\d{4}))?`, 'i').exec(input);
  if (match) {
    const month = monthNumber(match[1]);
    const iso = match[3] ? toIso(Number(match[3]), month, Number(match[2])) : inferYear(month, Number(match[2]), now);
    if (iso) return { iso, matched: match[0], strip: true };
  }

  match = /\b(\d{1,2})\/(\d{1,2})\b/.exec(input);
  if (match) {
    const iso = inferYear(Number(match[2]), Number(match[1]), now);
    if (iso) return { iso, matched: match[0], strip: true };
  }

  const today = todayIso(now);

  match = /\bday\s+after\s+(?:tomorrow|tmrw|tomorow|tommorow|tmr)\b/i.exec(input);
  if (match) return { iso: addDays(today, 2), matched: match[0], strip: true };
  match = /\b(?:tomorrow|tmrw|tomorow|tommorow|tmr)\b/i.exec(input);
  if (match) return { iso: addDays(today, 1), matched: match[0], strip: true };
  match = /\b(?:today|tonight)\b/i.exec(input);
  if (match) return { iso: today, matched: match[0], strip: match[0].toLowerCase() === 'today' };

  match = /\bin\s+(\d{1,2})\s+days?\b/i.exec(input);
  if (match) {
    return { iso: addDays(today, Number(match[1])), matched: match[0], strip: true };
  }

  match = /\b(?:next\s+week)\b/i.exec(input);
  if (match) {
    return { iso: addDays(today, 7), matched: match[0], strip: true };
  }

  match = new RegExp(
    `\\b(?:(next|this|coming|on)\\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)\\b`,
    'i',
  ).exec(input);
  if (match) {
    const name = match[2].toLowerCase();
    const isFull = name.length > 4 || ['friday', 'monday', 'sunday'].includes(name);
    if (isFull || match[1]) {
      const target = WEEKDAYS[name];
      let delta = (target - weekdayOf(today) + 7) % 7;
      if (delta === 0) delta = 7;
      return { iso: addDays(today, delta), matched: match[0], strip: true };
    }
  }

  match = /\b(?:on\s+the|the)\s+(\d{1,2})(?:st|nd|rd|th)\b|\bon\s+(\d{1,2})(?:st|nd|rd|th)\b/i.exec(input);
  if (match) {
    return dayOfMonth(Number(match[1] ?? match[2]), now, match[0]);
  }

  if (lenient) {
    match = /^\s*(\d{1,2})(?:st|nd|rd|th)?\s*$/i.exec(input);
    if (match) {
      return dayOfMonth(Number(match[1]), now, match[0]);
    }
  }

  return null;
}

function dayOfMonth(day: number, now: Date, matched: string): DateMatch | null {
  const today = todayIso(now);
  const thisMonth = toIso(now.getFullYear(), now.getMonth() + 1, day);
  if (thisMonth && thisMonth >= today) return { iso: thisMonth, matched, strip: true };
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const next = toIso(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, day);
  return next ? { iso: next, matched, strip: true } : null;
}

// ---------------------------------------------------------------- times

const PERIODS: Array<{ re: RegExp; from: string; to: string }> = [
  { re: /\bearly\s+morning\b/i, from: '04:00', to: '08:00' },
  { re: /\blate\s+night\b/i, from: '22:00', to: '23:59' },
  { re: /\bmorning\b/i, from: '05:00', to: '12:00' },
  { re: /\bafternoon\b/i, from: '12:00', to: '17:00' },
  { re: /\bevening\b/i, from: '17:00', to: '21:00' },
  { re: /\bnoon\b/i, from: '11:00', to: '13:00' },
  { re: /\b(?:tonight|night)\b/i, from: '20:00', to: '23:59' },
];

export type TimeMatch = { from: string; to: string; matched: string } | { any: true; matched: string };

const minutesOf = (hour: number, minute: number) => hour * 60 + minute;
const clockOf = (total: number) => {
  const clamped = Math.max(0, Math.min(1439, total));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
};

function to24(hour: number, minute: number, meridiem?: string): number {
  let h = hour;
  const mer = meridiem?.toLowerCase();
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  return minutesOf(h % 24, minute);
}

const ANY_TIME_RE = /\b(?:any\s*time|anytime|no\s+(?:time\s+)?preference|whenever|flexible|doesn'?t\s+matter|not\s+fussy|all\s+day|full\s+day)\b/i;

export function extractTime(input: string, lenient = false): TimeMatch | null {
  const any = ANY_TIME_RE.exec(input);
  if (any) return { any: true, matched: any[0] };
  if (lenient && /^\s*(?:any|anything|none|no|nothing|skip|all)\s*[.!]?\s*$/i.test(input)) {
    return { any: true, matched: input };
  }

  let match = /\b(?:(between|from)\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:and|to|till|until|-|–|—)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(
    input,
  );
  if (match) {
    const keyword = match[1];
    const h1 = Number(match[2]);
    const m1 = Number(match[3] ?? 0);
    const h2 = Number(match[5]);
    const m2 = Number(match[6] ?? 0);
    const mer1 = match[4];
    const mer2 = match[7];
    const looksLikeTime = Boolean(keyword || mer1 || mer2 || match[3] || match[6]);
    if (looksLikeTime && h1 <= 24 && h2 <= 24 && m1 < 60 && m2 < 60) {
      let start = to24(h1, m1, mer1 ?? mer2);
      const end = to24(h2, m2, mer2 ?? mer1);
      if (!mer1 && mer2 && start > end) {
        start = to24(h1, m1, mer2 === 'pm' ? 'am' : 'pm');
      }
      if (start > end) start = Math.max(0, end - 60);
      return { from: clockOf(start), to: clockOf(end), matched: match[0] };
    }
  }

  match = /\b(before|after|by|till|until|around|about|at|near|from)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(input);
  if (match) {
    const hour = Number(match[2]);
    const minute = Number(match[3] ?? 0);
    if (hour <= 24 && minute < 60) {
      return pointWindow(match[1].toLowerCase(), to24(hour, minute, match[4]), match[0]);
    }
  }

  match = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(input);
  if (match && Number(match[1]) <= 12) {
    return pointWindow('around', to24(Number(match[1]), Number(match[2] ?? 0), match[3]), match[0]);
  }

  match = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(input);
  if (match) {
    return pointWindow('around', minutesOf(Number(match[1]), Number(match[2])), match[0]);
  }

  for (const period of PERIODS) {
    const found = period.re.exec(input);
    if (found) return { from: period.from, to: period.to, matched: found[0] };
  }

  if (lenient) {
    match = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(input);
    if (match && Number(match[1]) <= 24) {
      return pointWindow('around', to24(Number(match[1]), Number(match[2] ?? 0), match[3]), match[0]);
    }
  }

  return null;
}

function pointWindow(keyword: string, minutes: number, matched: string): TimeMatch {
  if (keyword === 'before' || keyword === 'by' || keyword === 'till' || keyword === 'until') {
    return { from: '00:00', to: clockOf(minutes), matched };
  }
  if (keyword === 'after' || keyword === 'from') {
    return { from: clockOf(minutes), to: '23:59', matched };
  }
  return { from: clockOf(minutes - 60), to: clockOf(minutes + 60), matched };
}

// ---------------------------------------------------------------- service, class, passengers

const SERVICE_PATTERNS: Array<{ type: ServiceType; re: RegExp }> = [
  {
    type: 'TRAIN',
    re: /\b(?:trains?|rail(?:way)?s?|irctc|rajdhani|shatabdi|vande\s*bharat|duronto|tejas|intercity|express\s+train)\b/i,
  },
  { type: 'BUS', re: /\b(?:bus(?:es)?|volvo|coach|redbus)\b/i },
  {
    type: 'FLIGHT',
    re: /\b(?:flights?|fly(?:ing)?|planes?|air[a-z]?lane|aero[a-z]?lane|air\s*tickets?|airlines?|airways|indigo|air\s+india|spicejet|akasa|vistara)\b/i,
  },
];

export function detectService(input: string): ServiceType | undefined {
  let best: { type: ServiceType; index: number } | undefined;
  for (const pattern of SERVICE_PATTERNS) {
    const found = pattern.re.exec(input);
    if (found && (!best || found.index < best.index)) {
      best = { type: pattern.type, index: found.index };
    }
  }
  return best?.type;
}

function extractPassengers(input: string): { count: number; matched: string } | null {
  const match = /\b(\d{1,2})\s*(?:passengers?|persons?|people|adults?|pax|seats?|tickets?|travell?ers?)\b/i.exec(input);
  if (!match) return null;
  const count = Number(match[1]);
  return count >= 1 && count <= 9 ? { count, matched: match[0] } : null;
}

function extractClass(input: string): string | undefined {
  const match =
    /\b(premium\s+economy|economy|business\s+class|business|first\s+class|executive\s+chair\s+car|chair\s+car|semi[- ]?sleeper|sleeper|seater|non[- ]?ac|[123]a|2s)\b/i.exec(
      input,
    );
  if (!match) return undefined;
  const value = match[1].toLowerCase().replace(/\s+/g, ' ');
  if (/^[123]a$|^2s$/.test(value)) return value.toUpperCase();
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// ---------------------------------------------------------------- places

const NOISE = new Set(
  (
    'find finding search show need needs want wants wanna looking look for me my i we us a an the please plz pls kindly ' +
    'book booking get give check list available availability options option tickets ticket train trains bus buses ' +
    'flight flights plane planes airplane aeroplane travel travelling traveling trip go going leave leaving depart departing ' +
    'starting start reach reaching from on at by around about before after between till until tomorrow today tonight tmrw ' +
    'next this coming in dated date via with and or any anytime time morning afternoon evening night noon am pm that is it ' +
    "its it's i'd i'm id im to would like can could should will vande bharat express volvo sleeper ac nonstop direct cheap " +
    'cheapest fastest best earliest latest passengers passenger adult adults week weekend day days sunday monday tuesday ' +
    'wednesday thursday friday saturday jan feb mar apr may jun jul aug sep sept oct nov dec january february march april ' +
    'june july august september october november december then also just only some'
  ).split(' '),
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,;:!?()"“”[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

const isNoise = (token: string) => NOISE.has(token) || /^\d+$/.test(token);

function runEndingAt(tokens: string[]): string[] {
  const run: string[] = [];
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (isNoise(tokens[index])) break;
    run.unshift(tokens[index]);
  }
  return run;
}

function runStartingAt(tokens: string[]): string[] {
  const run: string[] = [];
  let index = 0;
  while (index < tokens.length && (tokens[index] === 'the' || tokens[index] === 'a')) index += 1;
  for (; index < tokens.length; index += 1) {
    if (isNoise(tokens[index])) break;
    run.push(tokens[index]);
  }
  return run;
}

const place = (tokens: string[]) => canonicalPlaceName(tokens.join(' '));

export function extractRoute(input: string): { source?: string; destination?: string } {
  const text = input
    .replace(/[→⇒➜➔]|->|=>/g, ' to ')
    .replace(/([a-z])\s+[-–—]\s+([a-z])/gi, '$1 to $2');
  const tokens = tokenize(text);
  const result: { source?: string; destination?: string } = {};
  let destinationOnly: string | undefined;

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index] !== 'to') continue;
    const left = runEndingAt(tokens.slice(0, index));
    const right = runStartingAt(tokens.slice(index + 1));
    if (left.length && right.length) {
      result.source = place(left);
      result.destination = place(right);
      return result;
    }
    if (!left.length && right.length && destinationOnly === undefined) {
      destinationOnly = place(right);
    }
  }

  const fromIndex = tokens.indexOf('from');
  if (fromIndex >= 0) {
    const after = runStartingAt(tokens.slice(fromIndex + 1));
    if (after.length) result.source = place(after);
  }
  if (destinationOnly) result.destination = destinationOnly;
  return result;
}

/** A bare answer like "Mumbai" or "it's Mumbai" to a "where?" question. */
export function extractShortPlace(input: string): string | undefined {
  const tokens = tokenize(input);
  const run: string[] = [];
  for (const token of tokens) {
    if (isNoise(token)) {
      if (run.length) break;
      continue;
    }
    run.push(token);
  }
  return run.length ? place(run) : undefined;
}

// ---------------------------------------------------------------- main

function stripOnce(text: string, part: string): string {
  return part ? text.replace(part, ' ') : text;
}

export function parseMessage(
  message: string,
  awaiting: Slot | null | undefined,
  now: Date = new Date(),
): Partial<Draft> {
  let text = message.trim().replace(/\s+/g, ' ');
  const result: Partial<Draft> = {};

  const service = detectService(text);
  if (service) {
    result.serviceType = service;
    // Remove every service keyword (including typos) so it can't leak into a place name.
    for (const pattern of SERVICE_PATTERNS) {
      text = text.replace(new RegExp(pattern.re.source, 'gi'), ' ');
    }
    text = text.replace(/\s+/g, ' ').trim();
  }

  const date = extractDate(text, now, awaiting === 'date');
  if (date) {
    result.date = date.iso;
    if (date.strip) text = stripOnce(text, date.matched);
  }

  const passengers = extractPassengers(text);
  if (passengers) {
    result.passengers = passengers.count;
    text = stripOnce(text, passengers.matched);
  }

  const time = extractTime(text, awaiting === 'time');
  if (time) {
    if ('any' in time) {
      result.anyTime = true;
    } else {
      result.timeFrom = time.from;
      result.timeTo = time.to;
    }
    text = stripOnce(text, time.matched);
  }

  const travelClass = extractClass(text);
  if (travelClass) result.travelClass = travelClass;

  const route = extractRoute(text);
  if (route.source) result.source = route.source;
  if (route.destination) result.destination = route.destination;

  if (!route.source && !route.destination && (awaiting === 'source' || awaiting === 'destination')) {
    const short = extractShortPlace(text);
    if (short) {
      if (awaiting === 'source') result.source = short;
      else result.destination = short;
    }
  }

  return result;
}
