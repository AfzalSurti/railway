import { Request, Response } from 'express';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { renderPrometheus, snapshot } from '../observability/metrics';

async function gauges(): Promise<Record<string, number>> {
  const [humanActionPending, queueDepth, unknownResult] = await Promise.all([
    prisma.humanActionRequest.count({ where: { status: 'PENDING' } }),
    prisma.bookingTask.count({ where: { status: { in: ['SCHEDULED', 'QUEUED', 'RUNNING'] } } }),
    prisma.bookingTask.count({ where: { status: 'UNKNOWN_RESULT' } }),
  ]);
  return {
    human_action_pending: humanActionPending,
    booking_queue_depth: queueDepth,
    booking_unknown_result_open: unknownResult,
  };
}

export const metricsController = {
  async prometheus(_req: Request, res: Response): Promise<void> {
    if (!env.METRICS_ENABLED) {
      res.status(404).type('text/plain').send('metrics disabled\n');
      return;
    }
    res.type('text/plain; version=0.0.4').send(renderPrometheus(await gauges()));
  },

  async json(_req: Request, res: Response): Promise<void> {
    if (!env.METRICS_ENABLED) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'metrics disabled' } });
      return;
    }
    res.json({ success: true, data: { ...snapshot(), ...(await gauges()) } });
  },
};
