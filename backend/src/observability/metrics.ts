import { env } from '../config/env';

/**
 * Lightweight in-process metrics. No dependency, no scrape server of its own —
 * the API exposes a Prometheus text endpoint at GET /metrics when
 * METRICS_ENABLED. Counters reset on process restart; that is acceptable for
 * this project's scale.
 */
const counters = new Map<string, number>();
const durations = new Map<string, { count: number; totalMs: number; maxMs: number }>();

export const METRIC_NAMES = [
  'booking_attempts_total',
  'booking_success_total',
  'booking_failure_total',
  'booking_unknown_result_total',
  'booking_authentication_required_total',
  'booking_payment_required_total',
  'provider_errors_total',
  'payment_failures_total',
  'human_action_created_total',
  'worker_job_failures_total',
] as const;

export type MetricName = (typeof METRIC_NAMES)[number];

export function incr(metric: MetricName, by = 1): void {
  if (!env.METRICS_ENABLED) {
    return;
  }
  counters.set(metric, (counters.get(metric) ?? 0) + by);
}

export function observeDuration(metric: string, ms: number): void {
  if (!env.METRICS_ENABLED) {
    return;
  }
  const entry = durations.get(metric) ?? { count: 0, totalMs: 0, maxMs: 0 };
  entry.count += 1;
  entry.totalMs += ms;
  entry.maxMs = Math.max(entry.maxMs, ms);
  durations.set(metric, entry);
}

export function snapshot(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const name of METRIC_NAMES) {
    out[name] = counters.get(name) ?? 0;
  }
  for (const [name, entry] of durations) {
    out[`${name}_count`] = entry.count;
    out[`${name}_avg_ms`] = entry.count ? Math.round(entry.totalMs / entry.count) : 0;
    out[`${name}_max_ms`] = entry.maxMs;
  }
  return out;
}

export function renderPrometheus(extraGauges: Record<string, number> = {}): string {
  const lines: string[] = [];
  const all = { ...snapshot(), ...extraGauges };
  for (const [name, value] of Object.entries(all)) {
    lines.push(`# TYPE ${name} gauge`);
    lines.push(`${name} ${value}`);
  }
  return `${lines.join('\n')}\n`;
}

export function resetMetrics(): void {
  counters.clear();
  durations.clear();
}
