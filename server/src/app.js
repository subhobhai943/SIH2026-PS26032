import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalLimiter, trafficMonitorMiddleware } from './middleware/rateLimiter.js';
import { mongoSanitizeMiddleware } from './utils/sanitize.js';
import farmerRoutes from './routes/farmerRoutes.js';
import slotRoutes from './routes/slotRoutes.js';
import queueRoutes from './routes/queueRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import shipmentRoutes from './routes/shipmentRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import operatorRoutes from './routes/operatorRoutes.js';

export function createApp() {
  const app = express();

  // Trust reverse proxies (Vercel, AWS ALB, Nginx) so rate-limiter sees real client IPs
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '15mb' }));
  app.use(mongoSanitizeMiddleware);
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  // Live traffic tracking and rate limiting
  app.use(trafficMonitorMiddleware);
  app.use('/api', globalLimiter);

  // Serve static uploaded media files
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  // High-availability health check for AWS ALB / Nginx Load Balancers
  const healthCheck = (req, res) => {
    const mem = process.memoryUsage();
    res.json({
      ok: true,
      status: 'HEALTHY',
      service: 'emandi-procurement-server',
      pid: process.pid,
      instanceId: process.env.NODE_APP_INSTANCE || '0',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      loadBalancer: {
        detectedIp: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        protocol: req.protocol,
        host: req.get('host'),
        forwardedProto: req.headers['x-forwarded-proto'] || 'direct',
      },
      memory: {
        rssMb: Math.round(mem.rss / (1024 * 1024)),
        heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
      },
      database: {
        status: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
      },
    });
  };

  app.get('/health', healthCheck);
  app.get('/api/health', healthCheck);

  app.use('/api/farmers', farmerRoutes);
  // Centre/slot browsing and booking share one router mounted at /api.
  app.use('/api', slotRoutes);
  app.use('/api/queue', queueRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/shipments', shipmentRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/operator', operatorRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
