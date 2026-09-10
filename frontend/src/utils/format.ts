export function formatDate(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function formatStartsIn(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  if (Number.isNaN(diff) || diff <= 0) {
    return 'Starting soon';
  }
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `Starts in ${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `Starts in ${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `Starts in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `Starts in ${seconds}s`;
}

export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
