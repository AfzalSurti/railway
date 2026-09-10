import { Request, Response } from 'express';
import { isDatabaseHealthy } from '../config/database';
import { isRedisHealthy } from '../queue/connection';

export const healthController = {
  async live(_req: Request, res: Response): Promise<void> {
    res.json({
      status: 'ok',
      service: 'ai-travel-agent-api',
    });
  },

  async database(_req: Request, res: Response): Promise<void> {
    const reachable = await isDatabaseHealthy();
    res.status(reachable ? 200 : 503).json({
      status: reachable ? 'ok' : 'error',
      service: 'ai-travel-agent-api',
      database: reachable ? 'connected' : 'unreachable',
    });
  },

  async redis(_req: Request, res: Response): Promise<void> {
    const reachable = await isRedisHealthy();
    res.status(reachable ? 200 : 503).json({
      status: reachable ? 'ok' : 'error',
      service: 'ai-travel-agent-api',
      redis: reachable ? 'connected' : 'unreachable',
    });
  },
};
