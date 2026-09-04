import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import farmerRoutes from './routes/farmerRoutes.js';
import slotRoutes from './routes/slotRoutes.js';
import queueRoutes from './routes/queueRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import shipmentRoutes from './routes/shipmentRoutes.js';

export function createApp() {
  const app = express();

  // Trust reverse proxies (Vercel, Nginx) so rate-limiter sees real client IPs
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use(
    rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false })
  );

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'sih26032-server', time: new Date().toISOString() }));

  app.use('/api/farmers', farmerRoutes);
  // Centre/slot browsing and booking share one router mounted at /api.
  app.use('/api', slotRoutes);
  app.use('/api/queue', queueRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/shipments', shipmentRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
