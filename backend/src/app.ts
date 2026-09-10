import './types/express';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import apiRoutes from './routes';
import healthRoutes from './routes/health.routes';
import { metricsController } from './controllers/metrics.controller';
import { requestId } from './middleware/requestId';
import { asyncHandler } from './utils/asyncHandler';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { openApiSpec } from './docs/openapi';
import './providers';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestId);

  app.use('/health', healthRoutes);
  app.get('/metrics', asyncHandler(metricsController.prometheus));
  app.get('/metrics.json', asyncHandler(metricsController.json));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'AI Travel Agent API' }));
  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
