import { BookingExecutionResult } from './booking-executor';
import { BookingResult } from '../providers/provider.types';
import {
  isProviderError,
  ProviderAuthenticationError,
  ProviderCaptchaError,
  ProviderNotImplementedError,
  ProviderOtpRequiredError,
  ProviderPaymentRequiredError,
  ProviderTimeoutError,
  ProviderUnknownResultError,
  ProviderUnsupportedError,
} from '../providers/provider-errors';

export function mapProviderResult(result: BookingResult): BookingExecutionResult {
  if (result.status === 'SUCCESS') {
    return {
      outcome: 'SUCCESS',
      bookingReference: result.providerBookingReference ?? `REF-${Date.now()}`,
      message: result.message,
    };
  }
  if (result.status === 'AUTHENTICATION_REQUIRED' || result.status === 'CAPTCHA_REQUIRED') {
    return {
      outcome: 'AUTHENTICATION_REQUIRED',
      failureCode: 'AUTHENTICATION_REQUIRED',
      failureReason: result.message,
    };
  }
  if (result.status === 'PRICE_CHANGED' || result.status === 'BOOKING_REJECTED') {
    return {
      outcome: 'FAILED',
      failureCode: result.status,
      failureReason: result.message,
      retryable: false,
    };
  }
  if (result.status === 'PAYMENT_REQUIRED') {
    return {
      outcome: 'PAYMENT_REQUIRED',
      failureCode: 'PAYMENT_REQUIRED',
      failureReason: result.message,
    };
  }
  if (result.status === 'UNKNOWN_RESULT') {
    return {
      outcome: 'UNKNOWN_RESULT',
      failureCode: 'UNKNOWN_RESULT',
      failureReason: result.message,
    };
  }
  return {
    outcome: 'FAILED',
    failureCode: result.failureCode ?? 'UNKNOWN_ERROR',
    failureReason: result.message,
    retryable: Boolean(result.retryable),
  };
}

export function mapProviderError(error: unknown): BookingExecutionResult {
  if (
    error instanceof ProviderAuthenticationError ||
    error instanceof ProviderCaptchaError ||
    error instanceof ProviderOtpRequiredError
  ) {
    return {
      outcome: 'AUTHENTICATION_REQUIRED',
      failureCode: 'AUTHENTICATION_REQUIRED',
      failureReason: error.message,
    };
  }
  if (error instanceof ProviderPaymentRequiredError) {
    return {
      outcome: 'PAYMENT_REQUIRED',
      failureCode: 'PAYMENT_REQUIRED',
      failureReason: error.message,
    };
  }
  if (error instanceof ProviderUnknownResultError) {
    return {
      outcome: 'UNKNOWN_RESULT',
      failureCode: 'UNKNOWN_RESULT',
      failureReason: error.message,
    };
  }
  if (error instanceof ProviderTimeoutError) {
    return {
      outcome: 'FAILED',
      failureCode: 'WEBSITE_TIMEOUT',
      failureReason: error.message,
      retryable: true,
    };
  }
  if (error instanceof ProviderUnsupportedError) {
    return {
      outcome: 'FAILED',
      failureCode: 'UNSUPPORTED_PROVIDER',
      failureReason: error.message,
      retryable: false,
    };
  }
  if (error instanceof ProviderNotImplementedError) {
    return {
      outcome: 'FAILED',
      failureCode: 'PROVIDER_NOT_IMPLEMENTED',
      failureReason: error.message,
      retryable: false,
    };
  }
  if (isProviderError(error)) {
    return {
      outcome: 'FAILED',
      failureCode: error.code,
      failureReason: error.message,
      retryable: error.retryable,
    };
  }
  return {
    outcome: 'FAILED',
    failureCode: 'UNKNOWN_ERROR',
    failureReason: error instanceof Error ? error.message : 'An unknown error occurred',
    retryable: false,
  };
}

export function actionTypeForOutcome(
  result: BookingExecutionResult,
): 'LOGIN' | 'OTP' | 'CAPTCHA' | 'PAYMENT' | 'CONFIRMATION' | 'MANUAL_REVIEW' | null {
  if (result.outcome === 'AUTHENTICATION_REQUIRED') {
    if (result.failureReason.toLowerCase().includes('captcha')) {
      return 'CAPTCHA';
    }
    if (result.failureReason.toLowerCase().includes('otp')) {
      return 'OTP';
    }
    return 'LOGIN';
  }
  if (result.outcome === 'PAYMENT_REQUIRED') {
    return 'PAYMENT';
  }
  if (result.outcome === 'UNKNOWN_RESULT') {
    return 'MANUAL_REVIEW';
  }
  return null;
}
