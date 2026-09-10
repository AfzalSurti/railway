import { describe, expect, it } from 'vitest';
import { ProviderFactory } from '../src/providers/provider.factory';
import { ProviderRegistry } from '../src/providers/provider-registry';
import { MockTrainProvider } from '../src/providers/mock/mock-train-provider';
import { IrctcProvider } from '../src/providers/irctc/irctc.provider';
import {
  ProviderAuthenticationError,
  ProviderNotImplementedError,
  ProviderPaymentRequiredError,
  ProviderTimeoutError,
  ProviderUnknownResultError,
  ProviderUnsupportedError,
} from '../src/providers/provider-errors';
import { mapProviderError, mapProviderResult } from '../src/execution/provider-result-mapper';
import { ProviderContext } from '../src/providers/base/provider-context';
import { BookingRequest } from '../src/providers/base/travel-provider';

function testRegistry() {
  const registry = new ProviderRegistry();
  registry.register(new MockTrainProvider());
  registry.register(new IrctcProvider());
  return new ProviderFactory(registry);
}

const context: ProviderContext = {
  bookingTaskId: 'task-1',
  serviceType: 'TRAIN',
  provider: 'MOCK',
  source: 'BRC',
  destination: 'MMCT',
  journeyDate: '2026-08-28',
  scheduledAt: '2026-08-27T04:25:00.000Z',
  trainNumber: '20902',
  travelClass: '3A',
  quota: 'GENERAL',
  passengers: [{ name: 'Rahul Jani', age: 30, gender: 'MALE' }],
  mockOutcome: 'SUCCESS',
};

describe('ProviderRegistry and ProviderFactory', () => {
  it('resolves TRAIN + MOCK and TRAIN + IRCTC', () => {
    const factory = testRegistry();
    expect(factory.get('TRAIN', 'MOCK')).toBeInstanceOf(MockTrainProvider);
    expect(factory.get('TRAIN', 'IRCTC')).toBeInstanceOf(IrctcProvider);
    expect(factory.isSupported('TRAIN', 'REDBUS')).toBe(false);
  });

  it('rejects unsupported combinations with UNSUPPORTED_PROVIDER', () => {
    const factory = testRegistry();
    try {
      factory.get('BUS', 'IRCTC');
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderUnsupportedError);
      expect((error as ProviderUnsupportedError).code).toBe('UNSUPPORTED_PROVIDER');
    }
  });
});

describe('MockTrainProvider', () => {
  it('searches BRC to MMCT Vande Bharat 20902', async () => {
    const provider = new MockTrainProvider();
    const result = await provider.search(
      {
        serviceType: 'TRAIN',
        source: 'BRC',
        destination: 'MMCT',
        journeyDate: '2026-08-28',
        trainNumber: '20902',
        departureTime: '15:51',
      },
      context,
    );
    expect(result.found).toBe(true);
    expect(result.journeys[0]?.trainNumber).toBe('20902');
    expect(result.journeys[0]?.trainName).toBe('Vande Bharat');
  });

  it('returns availability without assuming seats on unknown outcomes', async () => {
    const provider = new MockTrainProvider();
    const search = await provider.search(
      { serviceType: 'TRAIN', source: 'BRC', destination: 'MMCT', journeyDate: '2026-08-28', trainNumber: '20902' },
      context,
    );
    const availability = await provider.checkAvailability(
      { journey: search.journeys[0], travelClass: '3A' },
      context,
    );
    expect(availability.available).toBe(true);
    expect(availability.options[0]?.status).toBe('AVAILABLE');
    expect(availability.options[0]?.seats).toBe(12);
  });

  it('simulates executeBooking success', async () => {
    const provider = new MockTrainProvider();
    const request = await bookingRequest(provider, 'SUCCESS');
    const result = await provider.executeBooking(request);
    expect(result.status).toBe('SUCCESS');
    expect(result.providerBookingReference).toMatch(/^MOCK-/);
  });
});

describe('Provider error mapping', () => {
  it('maps timeout, auth, payment, unknown, and not implemented', () => {
    expect(mapProviderError(new ProviderTimeoutError())).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'WEBSITE_TIMEOUT',
    });
    expect(mapProviderError(new ProviderAuthenticationError()).outcome).toBe('AUTHENTICATION_REQUIRED');
    expect(mapProviderError(new ProviderPaymentRequiredError()).outcome).toBe('PAYMENT_REQUIRED');
    expect(mapProviderError(new ProviderUnknownResultError()).outcome).toBe('UNKNOWN_RESULT');
    expect(mapProviderError(new ProviderNotImplementedError())).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'PROVIDER_NOT_IMPLEMENTED',
    });
    expect(mapProviderResult({ status: 'SUCCESS', message: 'ok', providerBookingReference: 'MOCK-1' }).outcome).toBe(
      'SUCCESS',
    );
  });
});

describe('IrctcProvider skeleton', () => {
  it('returns NOT_IMPLEMENTED health and throws on booking calls', async () => {
    const provider = new IrctcProvider();
    expect(provider.getHealth()).toBe('NOT_IMPLEMENTED');
    await expect(provider.search({ serviceType: 'TRAIN', source: 'BRC', destination: 'MMCT', journeyDate: '2026-08-28' }, { ...context, provider: 'IRCTC' })).rejects.toBeInstanceOf(
      ProviderNotImplementedError,
    );
  });
});

async function bookingRequest(provider: MockTrainProvider, outcome: ProviderContext['mockOutcome']): Promise<BookingRequest> {
  const ctx = { ...context, mockOutcome: outcome };
  const searchReq = {
    serviceType: 'TRAIN' as const,
    source: 'BRC',
    destination: 'MMCT',
    journeyDate: '2026-08-28',
    trainNumber: '20902',
  };
  const search = await provider.search(searchReq, ctx);
  const availability = await provider.checkAvailability({ journey: search.journeys[0], travelClass: '3A' }, ctx);
  return {
    context: ctx,
    search: searchReq,
    journey: search.journeys[0],
    availability: availability.options[0],
  };
}
