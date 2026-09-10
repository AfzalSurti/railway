export type BookingExecutionContext = {
  bookingTaskId: string;
  attemptNumber: number;
  shouldCancel: () => Promise<boolean>;
};

export type BookingExecutionResult =
  | {
      outcome: 'SUCCESS';
      bookingReference: string;
      message: string;
    }
  | {
      outcome: 'FAILED';
      failureCode: string;
      failureReason: string;
      retryable: boolean;
    }
  | {
      outcome: 'AUTHENTICATION_REQUIRED';
      failureCode: 'AUTHENTICATION_REQUIRED';
      failureReason: string;
    }
  | {
      outcome: 'PAYMENT_REQUIRED';
      failureCode: 'PAYMENT_REQUIRED';
      failureReason: string;
    }
  | {
      outcome: 'UNKNOWN_RESULT';
      failureCode: 'UNKNOWN_RESULT';
      failureReason: string;
    }
  | {
      outcome: 'CANCELLED';
      message: string;
    };

export interface BookingExecutor {
  execute(bookingTaskId: string, context: BookingExecutionContext): Promise<BookingExecutionResult>;
}

export class RetryableExecutionError extends Error {
  readonly failureCode: string;

  constructor(failureCode: string, message: string) {
    super(message);
    this.name = 'RetryableExecutionError';
    this.failureCode = failureCode;
  }
}
