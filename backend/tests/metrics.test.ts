import { beforeEach, describe, expect, it } from 'vitest';
import { incr, observeDuration, renderPrometheus, resetMetrics, snapshot } from '../src/observability/metrics';

beforeEach(() => resetMetrics());

describe('metrics', () => {
  it('counts and renders Prometheus text', () => {
    incr('booking_attempts_total');
    incr('booking_attempts_total');
    incr('booking_success_total');
    const snap = snapshot();
    expect(snap.booking_attempts_total).toBe(2);
    expect(snap.booking_success_total).toBe(1);
    expect(snap.booking_failure_total).toBe(0);

    const text = renderPrometheus({ human_action_pending: 3 });
    expect(text).toContain('booking_attempts_total 2');
    expect(text).toContain('human_action_pending 3');
    expect(text).toMatch(/# TYPE booking_success_total gauge/);
  });

  it('tracks durations', () => {
    observeDuration('booking_exec', 100);
    observeDuration('booking_exec', 300);
    const snap = snapshot();
    expect(snap.booking_exec_count).toBe(2);
    expect(snap.booking_exec_avg_ms).toBe(200);
    expect(snap.booking_exec_max_ms).toBe(300);
  });
});
