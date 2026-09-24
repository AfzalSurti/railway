import { describe, expect, it } from 'vitest';
import { extractDate, extractRoute, extractTime, parseMessage } from '../src/assistant/parser';
import { handleAssistantMessage } from '../src/assistant/assistant.service';
import { sanitizeLlmOutput } from '../src/assistant/llm-extractor';
import { mergeDraft, missingSlots } from '../src/assistant/slots';
import '../src/providers';

// Monday, 10 Aug 2026 (local time)
const NOW = new Date(2026, 7, 10, 9, 0, 0);

describe('parser: service, route, date, time', () => {
  it('understands a full sentence in one go', () => {
    const parsed = parseMessage('Find a train from Vadodara to Mumbai on 28 August between 6 and 8 AM', null, NOW);
    expect(parsed).toMatchObject({
      serviceType: 'TRAIN',
      source: 'Vadodara',
      destination: 'Mumbai',
      date: '2026-08-28',
      timeFrom: '06:00',
      timeTo: '08:00',
    });
  });

  it('handles flights, typos, relative dates and named periods', () => {
    const parsed = parseMessage('airolane delhi to goa tomorrow evening', null, NOW);
    expect(parsed).toMatchObject({
      serviceType: 'FLIGHT',
      source: 'Delhi',
      destination: 'Goa',
      date: '2026-08-11',
      timeFrom: '17:00',
      timeTo: '21:00',
    });
  });

  it('handles buses with an "around" time and a weekday', () => {
    const parsed = parseMessage('bus ahmedabad to pune next friday around 9 pm', null, NOW);
    expect(parsed).toMatchObject({ serviceType: 'BUS', source: 'Ahmedabad', destination: 'Pune', date: '2026-08-14' });
    expect(parsed.timeFrom).toBe('20:00');
    expect(parsed.timeTo).toBe('22:00');
  });

  it('maps city aliases and multi-word places', () => {
    expect(extractRoute('train from new delhi to bombay')).toEqual({ source: 'Delhi', destination: 'Mumbai' });
    expect(extractRoute('i want to go from bangalore to hyderabad')).toEqual({
      source: 'Bengaluru',
      destination: 'Hyderabad',
    });
  });

  it('parses several date shapes and rolls past dates into next year', () => {
    expect(extractDate('on 2026-12-01', NOW)?.iso).toBe('2026-12-01');
    expect(extractDate('on 05/09/2026', NOW)?.iso).toBe('2026-09-05');
    expect(extractDate('Aug 28th', NOW)?.iso).toBe('2026-08-28');
    expect(extractDate('3 march', NOW)?.iso).toBe('2027-03-03');
    expect(extractDate('day after tomorrow', NOW)?.iso).toBe('2026-08-12');
    expect(extractDate('in 3 days', NOW)?.iso).toBe('2026-08-13');
  });

  it('parses time ranges and directions', () => {
    expect(extractTime('between 6 and 8 am')).toMatchObject({ from: '06:00', to: '08:00' });
    expect(extractTime('after 5pm')).toMatchObject({ from: '17:00', to: '23:59' });
    expect(extractTime('before 10 am')).toMatchObject({ from: '00:00', to: '10:00' });
    expect(extractTime('at 15:51')).toMatchObject({ from: '14:51', to: '16:51' });
    expect(extractTime('any time')).toMatchObject({ any: true });
  });
});

describe('parser: answers to a follow-up question', () => {
  it('reads a bare place for source and destination', () => {
    expect(parseMessage('Mumbai', 'destination', NOW)).toMatchObject({ destination: 'Mumbai' });
    expect(parseMessage("it's Vadodara", 'source', NOW)).toMatchObject({ source: 'Vadodara' });
  });

  it('reads a bare date, time and service', () => {
    expect(parseMessage('28', 'date', NOW)).toMatchObject({ date: '2026-08-28' });
    expect(parseMessage('7 pm', 'time', NOW)).toMatchObject({ timeFrom: '18:00', timeTo: '20:00' });
    expect(parseMessage('Any time', 'time', NOW)).toMatchObject({ anyTime: true });
    expect(parseMessage('Bus', 'serviceType', NOW)).toMatchObject({ serviceType: 'BUS' });
  });
});

describe('draft helpers', () => {
  it('lists what is still missing, in order', () => {
    expect(missingSlots({})).toEqual(['serviceType', 'source', 'destination', 'date', 'time']);
    expect(missingSlots({ serviceType: 'TRAIN', source: 'A', destination: 'B', date: '2026-08-28', anyTime: true })).toEqual([]);
  });

  it('merges without wiping earlier answers', () => {
    const merged = mergeDraft({ serviceType: 'TRAIN', source: 'Vadodara' }, { destination: 'Mumbai' });
    expect(merged).toEqual({ serviceType: 'TRAIN', source: 'Vadodara', destination: 'Mumbai' });
  });
});

describe('assistant conversation', () => {
  it('asks for everything when the message is vague', async () => {
    const res = await handleAssistantMessage({ message: 'hi, I want to travel' }, NOW);
    expect(res.status).toBe('NEEDS_INFO');
    if (res.status === 'NEEDS_INFO') {
      expect(res.awaiting).toBe('serviceType');
      expect(res.missing).toEqual(['serviceType', 'source', 'destination', 'date', 'time']);
    }
  });

  it('asks only for what is missing, then answers with results', async () => {
    const first = await handleAssistantMessage({ message: 'train from Vadodara to Mumbai' }, NOW);
    expect(first.status).toBe('NEEDS_INFO');
    if (first.status !== 'NEEDS_INFO') return;
    expect(first.missing).toEqual(['date', 'time']);
    expect(first.awaiting).toBe('date');

    const second = await handleAssistantMessage(
      { message: '28 August', draft: first.draft, awaiting: first.awaiting },
      NOW,
    );
    expect(second.status).toBe('NEEDS_INFO');
    if (second.status !== 'NEEDS_INFO') return;
    expect(second.awaiting).toBe('time');

    const third = await handleAssistantMessage(
      { message: 'between 6 and 10 AM', draft: second.draft, awaiting: second.awaiting },
      NOW,
    );
    expect(third.status).toBe('RESULTS');
    if (third.status !== 'RESULTS') return;
    expect(third.providers).toContain('MOCK');
    expect(third.results.length + (third.outsideWindow ? 0 : 0)).toBeGreaterThan(0);
    for (const option of third.results) {
      expect(option.source.name).toBe('Vadodara');
      expect(option.destination.name).toBe('Mumbai');
      if (!third.outsideWindow) {
        expect(option.departureTime >= '06:00' && option.departureTime <= '10:00').toBe(true);
      }
    }
  });

  it('searches buses and flights dynamically for any route', async () => {
    const bus = await handleAssistantMessage({ message: 'bus from Surat to Pune on 30 August, any time' }, NOW);
    expect(bus.status).toBe('RESULTS');
    if (bus.status === 'RESULTS') {
      expect(bus.results.length).toBeGreaterThan(3);
      expect(bus.results.every((option) => option.serviceType === 'BUS')).toBe(true);
    }

    const flight = await handleAssistantMessage({ message: 'flight jaipur to kolkata on 2 sept any time' }, NOW);
    expect(flight.status).toBe('RESULTS');
    if (flight.status === 'RESULTS') {
      expect(flight.results.every((option) => option.serviceType === 'FLIGHT')).toBe(true);
      expect(flight.results[0].source.code).toBe('JAI');
    }
  });

  it('is deterministic for the same route and date', async () => {
    const a = await handleAssistantMessage({ message: 'train delhi to agra on 20 august any time' }, NOW);
    const b = await handleAssistantMessage({ message: 'train delhi to agra on 20 august any time' }, NOW);
    expect(a).toEqual(b);
  });

  it('rejects a date in the past and asks again', async () => {
    const res = await handleAssistantMessage({ message: 'train delhi to agra on 2026-08-01 any time' }, NOW);
    expect(res.status).toBe('NEEDS_INFO');
    if (res.status === 'NEEDS_INFO') {
      expect(res.awaiting).toBe('date');
      expect(res.reply).toContain('already passed');
    }
  });
});

describe('LLM output sanitising (untrusted)', () => {
  it('keeps valid slots and drops junk', () => {
    const out = sanitizeLlmOutput(
      {
        serviceType: 'TRAIN',
        source: 'vadodara',
        destination: '<script>alert(1)</script>',
        date: '2026-08-28',
        timeFrom: '06:00',
        timeTo: '25:99',
        passengers: 99,
        extra: 'ignored',
      },
      '2026-08-10',
    );
    expect(out).toEqual({ serviceType: 'TRAIN', source: 'Vadodara', date: '2026-08-28' });
  });

  it('drops past dates and non-objects', () => {
    expect(sanitizeLlmOutput({ date: '2020-01-01' }, '2026-08-10')).toEqual({});
    expect(sanitizeLlmOutput('nonsense', '2026-08-10')).toEqual({});
  });
});
