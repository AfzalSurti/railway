export function delayUntilUtc(scheduledAt: Date, now = new Date()): number {
  return Math.max(0, scheduledAt.getTime() - now.getTime());
}

export function parseInstant(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid timestamp');
  }
  return parsed;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
