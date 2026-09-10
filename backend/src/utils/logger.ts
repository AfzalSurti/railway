type LogLevel = 'info' | 'warn' | 'error';

export type LogMeta = {
  service?: 'api' | 'worker' | 'scheduler' | 'executor';
  bookingTaskId?: string;
  jobId?: string;
  event?: string;
  status?: string;
  [key: string]: unknown;
};

function write(level: LogLevel, message: string, meta?: LogMeta): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta?.service ? { service: meta.service } : {}),
    ...(meta?.bookingTaskId ? { bookingTaskId: meta.bookingTaskId } : {}),
    ...(meta?.jobId ? { jobId: meta.jobId } : {}),
    ...(meta?.event ? { event: meta.event } : {}),
    ...(meta?.status ? { status: meta.status } : {}),
    ...(meta ? { meta: sanitize(meta) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

const SENSITIVE = /password|secret|token|authorization|cookie|credential|card|cvv|otp/i;

function sanitize(meta: LogMeta): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (['service', 'bookingTaskId', 'jobId', 'event', 'status'].includes(key)) {
      continue;
    }
    if (SENSITIVE.test(key)) {
      continue;
    }
    next[key] = value;
  }
  return next;
}

export const logger = {
  info: (message: string, meta?: LogMeta) => write('info', message, meta),
  warn: (message: string, meta?: LogMeta) => write('warn', message, meta),
  error: (message: string, meta?: LogMeta) => write('error', message, meta),
};
