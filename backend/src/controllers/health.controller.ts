import { Request, Response } from 'express';
import { isDatabaseHealthy } from '../config/database';
import { isRedisHealthy } from '../queue/connection';
import { providerRegistry } from '../providers';
import { env } from '../config/env';

export const healthController = {
  async live(_req: Request, res: Response): Promise<void> {
    res.json({
      status: 'ok',
      service: 'ai-travel-agent-api',
    });
  },

  async ready(_req: Request, res: Response): Promise<void> {
    const [database, redis] = await Promise.all([isDatabaseHealthy(), isRedisHealthy()]);
    const providers = providerRegistry.list().length;
    const providerConfig = {
      irctcBaseUrlConfigured: Boolean(env.IRCTC_BASE_URL),
      paymentProvider: env.PAYMENT_PROVIDER,
      reconciliation: env.PROVIDER_RECONCILE_ENABLED,
    };
    const ok = database && redis && providers > 0;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'error',
      service: 'ai-travel-agent-api',
      checks: {
        database: database ? 'ok' : 'error',
        redis: redis ? 'ok' : 'error',
        providers,
      },
      providerConfig,
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
