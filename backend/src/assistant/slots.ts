import { ServiceType } from '../providers/provider.types';

export const SLOTS = ['serviceType', 'source', 'destination', 'date', 'time'] as const;
export type Slot = (typeof SLOTS)[number];

/** Everything the assistant has understood so far. Echoed back by the client each turn. */
export type Draft = {
  serviceType?: ServiceType;
  source?: string;
  destination?: string;
  /** YYYY-MM-DD */
  date?: string;
  /** HH:MM (24h) departure window */
  timeFrom?: string;
  timeTo?: string;
  anyTime?: boolean;
  travelClass?: string;
  passengers?: number;
};

export function isTimeKnown(draft: Draft): boolean {
  return Boolean(draft.anyTime) || Boolean(draft.timeFrom && draft.timeTo);
}

export function missingSlots(draft: Draft): Slot[] {
  const missing: Slot[] = [];
  if (!draft.serviceType) missing.push('serviceType');
  if (!draft.source) missing.push('source');
  if (!draft.destination) missing.push('destination');
  if (!draft.date) missing.push('date');
  if (!isTimeKnown(draft)) missing.push('time');
  return missing;
}

/** Merges newly extracted values over the existing draft. Only defined keys win. */
export function mergeDraft(base: Draft, update: Partial<Draft>): Draft {
  const next: Draft = { ...base };
  for (const [key, value] of Object.entries(update)) {
    if (value !== undefined && value !== null && value !== '') {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  if (update.anyTime) {
    delete next.timeFrom;
    delete next.timeTo;
  } else if (update.timeFrom && update.timeTo) {
    delete next.anyTime;
  }
  return next;
}
