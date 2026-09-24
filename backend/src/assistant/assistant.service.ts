import { providerFactory } from '../providers';
import { ProviderContext } from '../providers/base/provider-context';
import { JourneyOption, SearchRequest, ServiceType } from '../providers/provider.types';
import { logger } from '../utils/logger';
import { llmExtract } from './llm-extractor';
import { parseMessage, todayIso } from './parser';
import { resolvePlace } from './places';
import { Draft, Slot, isTimeKnown, mergeDraft, missingSlots } from './slots';

export type TravelOption = {
  id: string;
  provider: string;
  serviceType: ServiceType;
  operator: string;
  number: string;
  name: string;
  source: { name: string; code: string };
  destination: { name: string; code: string };
  departureTime: string;
  arrivalTime: string;
  arrivalDayOffset: number;
  durationMinutes: number;
  /** Cheapest bookable fare in minor units. */
  fromFareMinor: number;
  currency: string;
  classes: Array<{ name: string; fareMinor: number; seatsLeft: number }>;
};

export type AssistantInput = {
  message: string;
  draft?: Draft;
  awaiting?: Slot | null;
};

export type AssistantResponse =
  | {
      status: 'NEEDS_INFO';
      reply: string;
      draft: Draft;
      awaiting: Slot;
      missing: Slot[];
      quickReplies: string[];
    }
  | {
      status: 'RESULTS';
      reply: string;
      draft: Draft;
      results: TravelOption[];
      /** True when nothing fell inside the requested time window and the closest departures are shown instead. */
      outsideWindow: boolean;
      providers: string[];
    };

const SERVICE_LABEL: Record<ServiceType, { one: string; many: string; title: string }> = {
  TRAIN: { one: 'train', many: 'trains', title: 'Train' },
  BUS: { one: 'bus', many: 'buses', title: 'Bus' },
  FLIGHT: { one: 'flight', many: 'flights', title: 'Flight' },
};

const PROMPTS: Record<Slot, { short: string; question: string; quick: string[] }> = {
  serviceType: {
    short: 'whether you want a train, bus or flight',
    question: 'Would you like to travel by train, bus or flight?',
    quick: ['Train', 'Bus', 'Flight'],
  },
  source: {
    short: 'where you are leaving from',
    question: 'Where are you leaving from?',
    quick: [],
  },
  destination: {
    short: 'where you want to go',
    question: 'Where do you want to go?',
    quick: [],
  },
  date: {
    short: 'the travel date',
    question: 'Which date do you want to travel? (for example 28 August, tomorrow or next Friday)',
    quick: ['Today', 'Tomorrow', 'Day after tomorrow'],
  },
  time: {
    short: 'your preferred departure time',
    question: 'What departure time suits you? (for example “between 6 and 8 AM”, “evening” — or say “any time”)',
    quick: ['Morning', 'Afternoon', 'Evening', 'Night', 'Any time'],
  },
};

export function prettyDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function prettyWindow(draft: Draft): string | null {
  if (draft.anyTime) return null;
  if (draft.timeFrom && draft.timeTo) return `${draft.timeFrom}–${draft.timeTo}`;
  return null;
}

export function describeDraft(draft: Draft): string {
  const parts: string[] = [];
  if (draft.serviceType) parts.push(SERVICE_LABEL[draft.serviceType].title);
  if (draft.source && draft.destination) parts.push(`${draft.source} → ${draft.destination}`);
  else if (draft.source) parts.push(`from ${draft.source}`);
  else if (draft.destination) parts.push(`to ${draft.destination}`);
  if (draft.date) parts.push(prettyDate(draft.date));
  const window = prettyWindow(draft);
  if (window) parts.push(window);
  else if (draft.anyTime) parts.push('any time');
  if (draft.travelClass) parts.push(draft.travelClass);
  return parts.join(' · ');
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function needsInfo(draft: Draft, missing: Slot[], notices: string[]): AssistantResponse {
  const first = missing[0];
  const known = describeDraft(draft);
  const pieces: string[] = [...notices];
  if (known) pieces.push(`Got it — ${known}.`);
  if (missing.length > 1) {
    pieces.push(`I still need ${joinList(missing.map((slot) => PROMPTS[slot].short))}.`);
  }
  pieces.push(PROMPTS[first].question);
  return {
    status: 'NEEDS_INFO',
    reply: pieces.join(' '),
    draft,
    awaiting: first,
    missing,
    quickReplies: PROMPTS[first].quick,
  };
}

const toMinutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest}m`;
}

function formatMoney(minor: number): string {
  return `₹${Math.round(minor / 100).toLocaleString('en-IN')}`;
}

function classMatches(name: string, wanted: string): boolean {
  const option = name.toLowerCase();
  const want = wanted.toLowerCase();
  if (want === 'ac') return option.includes('ac') && !/non[- ]?ac/.test(option);
  return option.includes(want);
}

function toTravelOption(
  journey: JourneyOption,
  provider: string,
  serviceType: ServiceType,
  source: { name: string; code: string },
  destination: { name: string; code: string },
): TravelOption {
  const classes = (journey.classOptions ?? journey.classes.map((name) => ({ name, fareMinor: 0, seatsLeft: 0 }))).map(
    (option) => ({ name: option.name, fareMinor: option.fareMinor, seatsLeft: option.seatsLeft }),
  );
  const bookable = classes.filter((option) => option.seatsLeft > 0 && option.fareMinor > 0);
  const priced = (bookable.length ? bookable : classes.filter((option) => option.fareMinor > 0)).map(
    (option) => option.fareMinor,
  );
  return {
    id: `${provider}:${journey.providerTrainId}`,
    provider,
    serviceType,
    operator: journey.operator ?? journey.trainName,
    number: journey.trainNumber,
    name: journey.trainName,
    source,
    destination,
    departureTime: journey.departureTime,
    arrivalTime: journey.arrivalTime,
    arrivalDayOffset: journey.arrivalDayOffset ?? 0,
    durationMinutes: journey.durationMinutes ?? 0,
    fromFareMinor: priced.length ? Math.min(...priced) : 0,
    currency: journey.currency ?? 'INR',
    classes,
  };
}

async function runSearch(draft: Draft, now: Date): Promise<AssistantResponse> {
  const serviceType = draft.serviceType as ServiceType;
  const source = resolvePlace(draft.source as string, serviceType);
  const destination = resolvePlace(draft.destination as string, serviceType);
  const label = SERVICE_LABEL[serviceType];

  const descriptors = providerFactory
    .list()
    .filter((descriptor) => descriptor.serviceType === serviceType && descriptor.available);

  if (descriptors.length === 0) {
    return {
      status: 'RESULTS',
      reply: `No ${label.one} provider is available right now.`,
      draft,
      results: [],
      outsideWindow: false,
      providers: [],
    };
  }

  const request: SearchRequest = {
    serviceType,
    source: source.code,
    destination: destination.code,
    journeyDate: draft.date as string,
    ...(draft.travelClass ? { serviceClass: draft.travelClass } : {}),
  };

  const settled = await Promise.allSettled(
    descriptors.map(async (descriptor) => {
      const provider = providerFactory.get(serviceType, descriptor.name);
      const context: ProviderContext = {
        bookingTaskId: 'assistant-search',
        serviceType,
        provider: descriptor.name,
        source: source.code,
        destination: destination.code,
        journeyDate: request.journeyDate,
        scheduledAt: now.toISOString(),
        trainNumber: null,
        travelClass: null,
        quota: null,
        passengers: [],
        mockOutcome: 'SUCCESS',
      };
      const result = await provider.search(request, context);
      return result.journeys.map((journey) =>
        toTravelOption(journey, descriptor.name, serviceType, source, destination),
      );
    }),
  );

  let options: TravelOption[] = [];
  const usedProviders: string[] = [];
  settled.forEach((entry, index) => {
    if (entry.status === 'fulfilled') {
      options = options.concat(entry.value);
      usedProviders.push(descriptors[index].name);
    } else {
      logger.warn('Assistant provider search failed', {
        service: 'api',
        event: 'ASSISTANT_PROVIDER_FAILED',
        provider: descriptors[index].name,
        message: entry.reason instanceof Error ? entry.reason.message.slice(0, 200) : 'unknown',
      });
    }
  });

  // Class preference: only narrow the list if something actually matches.
  let classNote = '';
  if (draft.travelClass) {
    const wanted = draft.travelClass;
    const narrowed = options
      .map((option) => ({ ...option, classes: option.classes.filter((entry) => classMatches(entry.name, wanted)) }))
      .filter((option) => option.classes.length > 0);
    if (narrowed.length > 0) {
      options = narrowed.map((option) => {
        const priced = option.classes.filter((entry) => entry.fareMinor > 0).map((entry) => entry.fareMinor);
        return { ...option, fromFareMinor: priced.length ? Math.min(...priced) : option.fromFareMinor };
      });
    } else {
      classNote = ` I couldn't find “${wanted}”, so I'm showing all classes.`;
    }
  }

  options.sort((a, b) => a.departureTime.localeCompare(b.departureTime));

  let results = options;
  let outsideWindow = false;
  let windowText = '';
  if (!draft.anyTime && draft.timeFrom && draft.timeTo) {
    const from = toMinutes(draft.timeFrom);
    const to = toMinutes(draft.timeTo);
    const inside = options.filter((option) => {
      const minutes = toMinutes(option.departureTime);
      return minutes >= from && minutes <= to;
    });
    windowText = ` departing between ${draft.timeFrom} and ${draft.timeTo}`;
    if (inside.length > 0) {
      results = inside;
    } else if (options.length > 0) {
      const centre = (from + to) / 2;
      results = [...options]
        .sort((a, b) => Math.abs(toMinutes(a.departureTime) - centre) - Math.abs(toMinutes(b.departureTime) - centre))
        .slice(0, 5)
        .sort((a, b) => a.departureTime.localeCompare(b.departureTime));
      outsideWindow = true;
    }
  }
  results = results.slice(0, 40);

  const route = `${source.name} to ${destination.name} on ${prettyDate(draft.date as string)}`;
  let reply: string;
  if (results.length === 0) {
    reply = `I couldn't find any ${label.many} from ${route}. Try another date or route.`;
  } else if (outsideWindow) {
    reply = `No ${label.many} from ${route}${windowText}. Here are the closest departures instead.${classNote}`;
  } else {
    const cheapest = [...results].filter((o) => o.fromFareMinor > 0).sort((a, b) => a.fromFareMinor - b.fromFareMinor)[0];
    const fastest = [...results].filter((o) => o.durationMinutes > 0).sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
    const highlights: string[] = [];
    if (cheapest) highlights.push(`cheapest ${formatMoney(cheapest.fromFareMinor)}`);
    if (fastest) highlights.push(`fastest ${formatDuration(fastest.durationMinutes)}`);
    reply =
      `I found ${results.length} ${results.length === 1 ? label.one : label.many} from ${route}${windowText}.` +
      (highlights.length ? ` (${highlights.join(', ')})` : '') +
      classNote;
  }

  return { status: 'RESULTS', reply, draft, results, outsideWindow, providers: usedProviders };
}

/**
 * One conversational turn. Stateless: the client sends back the draft it got
 * last time, we merge what the new message adds, then either ask for the next
 * missing detail or run the search. Nothing here writes to the database.
 */
export async function handleAssistantMessage(
  input: AssistantInput,
  now: Date = new Date(),
): Promise<AssistantResponse> {
  const today = todayIso(now);
  const awaiting = input.awaiting ?? null;
  const base: Draft = input.draft ?? {};

  let draft = mergeDraft(base, parseMessage(input.message, awaiting, now));
  const fromModel = await llmExtract(input.message, draft, awaiting, today);
  if (fromModel) draft = mergeDraft(draft, fromModel);

  const notices: string[] = [];
  if (draft.date && draft.date < today) {
    delete draft.date;
    notices.push('That date has already passed.');
  }
  if (draft.source && draft.destination && draft.source.toLowerCase() === draft.destination.toLowerCase()) {
    delete draft.destination;
    notices.push('The start and end can’t be the same place.');
  }

  const missing = missingSlots(draft);
  if (missing.length > 0 || !isTimeKnown(draft)) {
    return needsInfo(draft, missing.length ? missing : ['time'], notices);
  }
  return runSearch(draft, now);
}
