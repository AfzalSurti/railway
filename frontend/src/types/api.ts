export type ApiSuccess<T> = {
  success: true;
  message?: string;
  data: T;
};

export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ path?: string; message?: string }>;
  };
};
