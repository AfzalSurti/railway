import { describe, expect, it } from 'vitest';
import { MockTrainProvider } from '../src/providers/mock/mock-train-provider';
import { IrctcProvider } from '../src/providers/irctc/irctc.provider';
import { ProviderRegistry } from '../src/providers/provider-registry';
import { ProviderCapabilityError, ProviderNotImplementedError } from '../src/providers/provider-errors';
import { ProviderContext } from '../src/providers/base/provider-context';

const context: ProviderContext = {
  bookingTaskId: 'task-cap',
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

describe('Provider capabilities', () => {
  it('MockTrainProvider declares its supported operations', () => {
    const provider = new MockTrainProvider();
    const caps = provider.getCapabilities();
    expect(caps).toEqual(
      expect.arrayContaining(['SEARCH', 'AVAILABILITY', 'BOOKING', 'CANCELLATION', 'TICKET_DOWNLOAD', 'STATUS_RECONCILIATION']),
    );
    expect(provider.hasCapability('PAYMENT')).toBe(false);
  });

  it('exposes capabilities through the registry descriptor', () => {
    const registry = new ProviderRegistry();
    registry.register(new MockTrainProvider());
    const descriptor = registry.descriptors().find((d) => d.name === 'MOCK');
    expect(descriptor?.capabilities).toContain('BOOKING');
  });

  it('IrctcProvider advertises capabilities but every operation is not implemented', async () => {
    const provider = new IrctcProvider();
    expect(provider.getCapabilities().length).toBeGreaterThan(0);
    await expect(
      provider.search({ serviceType: 'TRAIN', source: 'BRC', destination: 'MMCT', journeyDate: '2026-08-28' }, context),
    ).rejects.toBeInstanceOf(ProviderNotImplementedError);
  });
});

describe('MockTrainProvider status reconciliation and ticket download', () => {
  it('reconciles a confirmed booking', async () => {
    const provider = new MockTrainProvider();
    const status = await provider.getBookingStatus(
      { providerBookingReference: '' },
      { ...context, mockOutcome: 'UNKNOWN_RESULT_RECONCILE_CONFIRMED' },
    );
    expect(status.state).toBe('CONFIRMED');
    expect(status.providerBookingReference).toBeTruthy();
  });

  it('reconciles a failed booking', async () => {
    const provider = new MockTrainProvider();
    const status = await provider.getBookingStatus(
      { providerBookingReference: '' },
      { ...context, mockOutcome: 'UNKNOWN_RESULT_RECONCILE_FAILED' },
    );
    expect(status.state).toBe('FAILED');
  });

  it('returns UNKNOWN when it cannot determine the state', async () => {
    const provider = new MockTrainProvider();
    const status = await provider.getBookingStatus(
      { providerBookingReference: '' },
      { ...context, mockOutcome: 'UNKNOWN_RESULT' },
    );
    expect(status.state).toBe('UNKNOWN');
  });

  it('downloads a mock ticket as base64 PDF', async () => {
    const provider = new MockTrainProvider();
    const ticket = await provider.downloadTicket('MOCK-123456', context);
    expect(ticket.mimeType).toBe('application/pdf');
    expect(Buffer.from(ticket.contentBase64, 'base64').toString('utf8')).toContain('%PDF-1.4');
  });

  it('surfaces a typed error when ticket download fails', async () => {
    const provider = new MockTrainProvider();
    await expect(
      provider.downloadTicket('MOCK-123456', { ...context, mockOutcome: 'TICKET_DOWNLOAD_FAILED' }),
    ).rejects.toMatchObject({ code: 'TICKET_DOWNLOAD_FAILED' });
  });
});

describe('Capability guard', () => {
  it('throws ProviderCapabilityError from assertCapability', () => {
    class NoBookingProvider extends MockTrainProvider {
      protected readonly capabilities = ['SEARCH'] as const;
      poke() {
        this.assertCapability('BOOKING');
      }
    }
    expect(() => new NoBookingProvider().poke()).toThrow(ProviderCapabilityError);
  });
});
