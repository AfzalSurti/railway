import type { ServiceType } from './booking';

export type AssistantSlot = 'serviceType' | 'source' | 'destination' | 'date' | 'time';

export type AssistantDraft = {
  serviceType?: ServiceType;
  source?: string;
  destination?: string;
  date?: string;
  timeFrom?: string;
  timeTo?: string;
  anyTime?: boolean;
  travelClass?: string;
  passengers?: number;
};

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
  fromFareMinor: number;
  currency: string;
  classes: Array<{ name: string; fareMinor: number; seatsLeft: number }>;
};

export type AssistantResponse =
  | {
      status: 'NEEDS_INFO';
      reply: string;
      draft: AssistantDraft;
      awaiting: AssistantSlot;
      missing: AssistantSlot[];
      quickReplies: string[];
    }
  | {
      status: 'RESULTS';
      reply: string;
      draft: AssistantDraft;
      results: TravelOption[];
      outsideWindow: boolean;
      providers: string[];
    };
