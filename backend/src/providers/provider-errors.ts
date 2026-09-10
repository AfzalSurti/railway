export type ProviderErrorStage =
  | 'INITIALIZING'
  | 'AUTHENTICATION'
  | 'SEARCH'
  | 'AVAILABILITY'
  | 'SELECTION'
  | 'PASSENGER_DETAILS'
  | 'PAYMENT'
  | 'CONFIRMATION'
  | 'TICKET_DOWNLOAD'
  | 'RECONCILIATION'
  | 'UNKNOWN';

export type ProviderErrorInit = {
  message: string;
  retryable?: boolean;
  requiresHumanAction?: boolean;
  stage?: ProviderErrorStage;
  provider?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

/**
 * Structured provider error. Every provider failure that reaches the execution
 * engine should be one of these so it can be mapped to a booking state.
 * `metadata` must never contain secrets (cookies, tokens, OTP, card data).
 */
export class ProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly requiresHumanAction: boolean;
  readonly stage: ProviderErrorStage;
  provider: string | undefined;
  readonly metadata: Record<string, string | number | boolean | null>;

  constructor(code: string, init: ProviderErrorInit | string, retryableLegacy = false) {
    const opts: ProviderErrorInit =
      typeof init === 'string' ? { message: init, retryable: retryableLegacy } : init;
    super(opts.message);
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = opts.retryable ?? false;
    this.requiresHumanAction = opts.requiresHumanAction ?? false;
    this.stage = opts.stage ?? 'UNKNOWN';
    this.provider = opts.provider;
    this.metadata = opts.metadata ?? {};
  }

  withProvider(provider: string): this {
    if (!this.provider) {
      this.provider = provider;
    }
    return this;
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(message = 'Booking website timed out', stage: ProviderErrorStage = 'UNKNOWN') {
    super('WEBSITE_TIMEOUT', { message, retryable: true, stage });
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(message = 'Provider is currently unavailable', code = 'PROVIDER_UNAVAILABLE', retryable = false) {
    super(code, { message, retryable, stage: 'INITIALIZING' });
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderAuthenticationError extends ProviderError {
  constructor(message = 'User authentication is required to continue.') {
    super('AUTHENTICATION_REQUIRED', {
      message,
      requiresHumanAction: true,
      stage: 'AUTHENTICATION',
    });
    this.name = 'ProviderAuthenticationError';
  }
}

export class ProviderOtpRequiredError extends ProviderError {
  constructor(message = 'An OTP is required. The user must complete verification.') {
    super('OTP_REQUIRED', { message, requiresHumanAction: true, stage: 'AUTHENTICATION' });
    this.name = 'ProviderOtpRequiredError';
  }
}

export class ProviderCaptchaError extends ProviderError {
  constructor(message = 'CAPTCHA verification is required. This must be completed by the user.') {
    super('CAPTCHA_REQUIRED', { message, requiresHumanAction: true, stage: 'AUTHENTICATION' });
    this.name = 'ProviderCaptchaError';
  }
}

export class ProviderPaymentRequiredError extends ProviderError {
  constructor(message = 'Payment authorization is required to continue.') {
    super('PAYMENT_REQUIRED', { message, requiresHumanAction: true, stage: 'PAYMENT' });
    this.name = 'ProviderPaymentRequiredError';
  }
}

export class ProviderPaymentFailedError extends ProviderError {
  constructor(message = 'Payment was declined by the payment provider.') {
    super('PAYMENT_FAILED', { message, retryable: false, stage: 'PAYMENT' });
    this.name = 'ProviderPaymentFailedError';
  }
}

export class ProviderPriceChangedError extends ProviderError {
  constructor(message = 'The fare changed before the booking could be confirmed.') {
    super('PRICE_CHANGED', { message, retryable: false, requiresHumanAction: true, stage: 'CONFIRMATION' });
    this.name = 'ProviderPriceChangedError';
  }
}

export class ProviderNoSeatsError extends ProviderError {
  constructor(message = 'No seats are available for the selected option.') {
    super('NO_SEATS', { message, retryable: false, stage: 'AVAILABILITY' });
    this.name = 'ProviderNoSeatsError';
  }
}

export class ProviderJourneyNotFoundError extends ProviderError {
  constructor(message = 'The requested train or service was not found.') {
    super('TRAIN_NOT_FOUND', { message, retryable: false, stage: 'SEARCH' });
    this.name = 'ProviderJourneyNotFoundError';
  }
}

export class ProviderBookingRejectedError extends ProviderError {
  constructor(message = 'The provider rejected the booking request.') {
    super('BOOKING_REJECTED', { message, retryable: false, stage: 'CONFIRMATION' });
    this.name = 'ProviderBookingRejectedError';
  }
}

export class ProviderUnknownResultError extends ProviderError {
  constructor(
    message = 'Booking result could not be safely determined. Manual investigation required.',
    stage: ProviderErrorStage = 'CONFIRMATION',
  ) {
    super('UNKNOWN_RESULT', { message, retryable: false, requiresHumanAction: true, stage });
    this.name = 'ProviderUnknownResultError';
  }
}

export class ProviderTicketDownloadError extends ProviderError {
  constructor(message = 'The ticket could not be downloaded from the provider.') {
    super('TICKET_DOWNLOAD_FAILED', { message, retryable: true, stage: 'TICKET_DOWNLOAD' });
    this.name = 'ProviderTicketDownloadError';
  }
}

export class ProviderHumanActionRequiredError extends ProviderError {
  constructor(message = 'A human action is required before the booking can continue.') {
    super('HUMAN_ACTION_REQUIRED', { message, requiresHumanAction: true, stage: 'CONFIRMATION' });
    this.name = 'ProviderHumanActionRequiredError';
  }
}

export class ProviderNotImplementedError extends ProviderError {
  constructor(message = 'This provider is not implemented yet.') {
    super('PROVIDER_NOT_IMPLEMENTED', { message, retryable: false, stage: 'INITIALIZING' });
    this.name = 'ProviderNotImplementedError';
  }
}

export class ProviderCapabilityError extends ProviderError {
  constructor(provider: string, capability: string) {
    super('PROVIDER_CAPABILITY_UNSUPPORTED', {
      message: `Provider ${provider} does not support ${capability}`,
      retryable: false,
      stage: 'INITIALIZING',
      provider,
    });
    this.name = 'ProviderCapabilityError';
  }
}

export class ProviderUnsupportedError extends ProviderError {
  constructor(serviceType: string, provider: string) {
    super('UNSUPPORTED_PROVIDER', {
      message: `Unsupported provider combination: ${serviceType} + ${provider}`,
      retryable: false,
      stage: 'INITIALIZING',
    });
    this.name = 'ProviderUnsupportedError';
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}
