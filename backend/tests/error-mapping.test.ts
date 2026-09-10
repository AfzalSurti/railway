import { describe, expect, it } from 'vitest';
import {
  isNonRetryableFailureCode,
  isRetryableFailureCode,
} from '../src/queue/queue.types';
import { mapProviderError, mapProviderResult } from '../src/execution/provider-result-mapper';
import {
  ProviderBookingRejectedError,
  ProviderCapabilityError,
  ProviderOtpRequiredError,
  ProviderPriceChangedError,
  ProviderTicketDownloadError,
  ProviderTimeoutError,
  ProviderUnknownResultError,
} from '../src/providers/provider-errors';

describe('retry classification', () => {
  it('only the three transient codes are retryable', () => {
    expect(isRetryableFailureCode('WEBSITE_TIMEOUT')).toBe(true);
    expect(isRetryableFailureCode('NETWORK_ERROR')).toBe(true);
    expect(isRetryableFailureCode('TEMPORARY_SERVER_ERROR')).toBe(true);
  });

  it('ambiguous / final / payment codes are never retryable', () => {
    for (const code of [
      'UNKNOWN_RESULT',
      'BOOKING_NOT_CONFIRMED',
      'BOOKING_ALREADY_CONFIRMED',
      'PAYMENT_REQUIRED',
      'PAYMENT_FAILED',
      'NO_SEATS',
      'PROVIDER_CAPABILITY_UNSUPPORTED',
    ]) {
      expect(isNonRetryableFailureCode(code)).toBe(true);
      expect(isRetryableFailureCode(code)).toBe(false);
    }
  });
});

describe('provider error mapping', () => {
  it('routes OTP to AUTHENTICATION_REQUIRED', () => {
    expect(mapProviderError(new ProviderOtpRequiredError()).outcome).toBe('AUTHENTICATION_REQUIRED');
  });

  it('maps price-changed and booking-rejected to non-retryable FAILED', () => {
    expect(mapProviderError(new ProviderPriceChangedError())).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'PRICE_CHANGED',
      retryable: false,
    });
    expect(mapProviderError(new ProviderBookingRejectedError())).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'BOOKING_REJECTED',
    });
  });

  it('maps capability + ticket + timeout + unknown errors', () => {
    expect(mapProviderError(new ProviderCapabilityError('MOCK', 'PAYMENT')).failureCode).toBe(
      'PROVIDER_CAPABILITY_UNSUPPORTED',
    );
    expect(mapProviderError(new ProviderTicketDownloadError()).failureCode).toBe('TICKET_DOWNLOAD_FAILED');
    expect(mapProviderError(new ProviderTimeoutError()).failureCode).toBe('WEBSITE_TIMEOUT');
    expect(mapProviderError(new ProviderUnknownResultError()).outcome).toBe('UNKNOWN_RESULT');
  });

  it('maps provider booking result statuses', () => {
    expect(mapProviderResult({ status: 'PRICE_CHANGED', message: 'fare up' })).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'PRICE_CHANGED',
    });
    expect(
      mapProviderResult({ status: 'SUCCESS', message: 'ok', providerBookingReference: 'MOCK-1' }).outcome,
    ).toBe('SUCCESS');
  });
});
