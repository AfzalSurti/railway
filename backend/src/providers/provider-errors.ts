export class ProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = retryable;
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(message = 'Booking website timed out') {
    super('WEBSITE_TIMEOUT', message, true);
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderAuthenticationError extends ProviderError {
  constructor(message = 'User authentication is required to continue.') {
    super('AUTHENTICATION_REQUIRED', message, false);
    this.name = 'ProviderAuthenticationError';
  }
}

export class ProviderCaptchaError extends ProviderError {
  constructor(message = 'CAPTCHA verification is required. This must be completed by the user.') {
    super('CAPTCHA_REQUIRED', message, false);
    this.name = 'ProviderCaptchaError';
  }
}

export class ProviderPaymentRequiredError extends ProviderError {
  constructor(message = 'Payment authentication required') {
    super('PAYMENT_REQUIRED', message, false);
    this.name = 'ProviderPaymentRequiredError';
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(message = 'Provider is currently unavailable', code = 'PROVIDER_UNAVAILABLE', retryable = false) {
    super(code, message, retryable);
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderUnknownResultError extends ProviderError {
  constructor(
    message = 'Booking result could not be safely determined. Manual investigation required.',
  ) {
    super('UNKNOWN_RESULT', message, false);
    this.name = 'ProviderUnknownResultError';
  }
}

export class ProviderNotImplementedError extends ProviderError {
  constructor(message = 'This provider is not implemented yet.') {
    super('PROVIDER_NOT_IMPLEMENTED', message, false);
    this.name = 'ProviderNotImplementedError';
  }
}

export class ProviderUnsupportedError extends ProviderError {
  constructor(serviceType: string, provider: string) {
    super(
      'UNSUPPORTED_PROVIDER',
      `Unsupported provider combination: ${serviceType} + ${provider}`,
      false,
    );
    this.name = 'ProviderUnsupportedError';
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}
