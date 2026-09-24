import { knownDistanceKm } from '../../assistant/places';
import { ClassOption, JourneyOption, ServiceType } from '../provider.types';

/**
 * Deterministic, dynamic mock inventory. Given a route and a date it always
 * produces the same believable set of trains / buses / flights, so the travel
 * assistant can be exercised end-to-end without any real provider.
 */

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function clock(totalMinutes: number): string {
  const minutes = ((totalMinutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

const TRAIN_NAMES = [
  'Vande Bharat Express',
  'Shatabdi Express',
  'Rajdhani Express',
  'Duronto Express',
  'Tejas Express',
  'Superfast Express',
  'Intercity Express',
  'Jan Shatabdi',
  'Garib Rath',
  'Double Decker Express',
];
const BUS_OPERATORS = [
  'RedLine Travels',
  'Orange Tours',
  'SRS Travels',
  'Neeta Volvo',
  'Patel Travels',
  'State Transport Volvo',
  'VRL Travels',
  'Sharma Travels',
  'Kadamba Express',
  'IntrCity SmartBus',
];
const AIRLINES: Array<{ name: string; code: string }> = [
  { name: 'IndiGo', code: '6E' },
  { name: 'Air India', code: 'AI' },
  { name: 'Akasa Air', code: 'QP' },
  { name: 'Vistara', code: 'UK' },
  { name: 'SpiceJet', code: 'SG' },
  { name: 'Air India Express', code: 'IX' },
];

type Kind = {
  count: [number, number];
  distance: [number, number];
  /** km per hour (door-to-door average) */
  speed: number;
  overheadMinutes: number;
};

const KINDS: Record<ServiceType, Kind> = {
  TRAIN: { count: [11, 15], distance: [180, 1800], speed: 68, overheadMinutes: 0 },
  BUS: { count: [12, 18], distance: [90, 900], speed: 46, overheadMinutes: 0 },
  FLIGHT: { count: [8, 12], distance: [350, 2200], speed: 680, overheadMinutes: 40 },
};

export type InventoryRequest = {
  source: string;
  destination: string;
  journeyDate: string;
};

function classesFor(
  kind: ServiceType,
  distanceKm: number,
  next: () => number,
  fareFactor: number,
): ClassOption[] {
  const seats = () => (next() < 0.12 ? 0 : Math.floor(next() * 58) + 2);
  const fare = (value: number) => Math.round(value * fareFactor) * 100;

  if (kind === 'TRAIN') {
    const all: Array<[string, number]> = [
      ['SL', 0.55],
      ['3A', 1.45],
      ['2A', 2.05],
      ['1A', 3.5],
      ['CC', 1.65],
      ['EC', 3.1],
    ];
    const picked = all.filter(() => next() > 0.3);
    const list = picked.length >= 2 ? picked : all.slice(0, 3);
    return list.map(([name, perKm]) => ({
      name,
      fareMinor: fare(45 + distanceKm * perKm),
      seatsLeft: seats(),
    }));
  }
  if (kind === 'BUS') {
    const all: Array<[string, number]> = [
      ['Seater Non-AC', 0.85],
      ['Seater AC', 1.3],
      ['Semi-Sleeper AC', 1.55],
      ['Sleeper AC', 1.9],
    ];
    const picked = all.filter(() => next() > 0.25);
    const list = picked.length >= 2 ? picked : all.slice(1, 4);
    return list.map(([name, perKm]) => ({
      name,
      fareMinor: fare(60 + distanceKm * perKm),
      seatsLeft: seats(),
    }));
  }
  const base = 2300 + distanceKm * 3.9;
  return [
    { name: 'Economy', fareMinor: fare(base), seatsLeft: seats() },
    { name: 'Premium Economy', fareMinor: fare(base * 1.6), seatsLeft: seats() },
    { name: 'Business', fareMinor: fare(base * 3.3), seatsLeft: seats() },
  ].filter((option, index) => index === 0 || next() > 0.35);
}

export function generateOptions(kind: ServiceType, request: InventoryRequest): JourneyOption[] {
  const config = KINDS[kind];
  const pair = [request.source, request.destination].map((value) => value.toLowerCase()).sort().join('|');
  const day = `${kind}|${request.source.toLowerCase()}|${request.destination.toLowerCase()}|${request.journeyDate}`;

  const pairRandom = rng(`${kind}|pair|${pair}`);
  const straight = knownDistanceKm(request.source, request.destination);
  const distanceKm = straight
    ? Math.max(30, Math.round(straight * (kind === 'FLIGHT' ? 1.05 : 1.28)))
    : Math.round(config.distance[0] + pairRandom() * (config.distance[1] - config.distance[0]));

  const next = rng(day);
  const count = config.count[0] + Math.floor(next() * (config.count[1] - config.count[0] + 1));
  // Prices drift a little day to day (±12%).
  const fareFactor = 0.88 + next() * 0.24;

  const options: JourneyOption[] = [];
  for (let index = 0; index < count; index += 1) {
    const slot = 1440 / count;
    const departure = Math.min(1435, Math.round(((index + next() * 0.9) * slot) / 5) * 5);
    const wobble = 0.9 + next() * 0.25;
    const durationMinutes = Math.max(
      kind === 'FLIGHT' ? 55 : 35,
      Math.round(((distanceKm / config.speed) * 60 * wobble + config.overheadMinutes) / 5) * 5,
    );
    const arrival = departure + durationMinutes;

    let number: string;
    let name: string;
    let operator: string;
    if (kind === 'TRAIN') {
      number = String(12000 + Math.floor(next() * 8900));
      name = TRAIN_NAMES[Math.floor(next() * TRAIN_NAMES.length)];
      operator = 'Indian Railways';
    } else if (kind === 'BUS') {
      operator = BUS_OPERATORS[Math.floor(next() * BUS_OPERATORS.length)];
      number = `BUS-${1000 + Math.floor(next() * 8999)}`;
      name = operator;
    } else {
      const airline = AIRLINES[Math.floor(next() * AIRLINES.length)];
      operator = airline.name;
      number = `${airline.code}-${100 + Math.floor(next() * 899)}`;
      name = `${airline.name} ${number}`;
    }

    const classOptions = classesFor(kind, distanceKm, next, fareFactor);
    options.push({
      providerTrainId: `mock-${kind.toLowerCase()}-${number}-${request.journeyDate}`,
      trainNumber: number,
      trainName: name,
      source: request.source,
      destination: request.destination,
      departureTime: clock(departure),
      arrivalTime: clock(arrival),
      classes: classOptions.map((option) => option.name),
      serviceType: kind,
      operator,
      durationMinutes,
      arrivalDayOffset: Math.floor(arrival / 1440),
      currency: 'INR',
      classOptions,
    });
  }

  return options.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
}
