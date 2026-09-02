import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { RATE_LIMITS } from './config/constants.js';
import { logger } from './lib/logger.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { testConnection } from './db/connection.js';
import { testOllamaHealth } from './adapters/ollama.adapter.js';
import { loadSkillCache } from './services/skill-normalizer.service.js';
import { prewarmCourseCache } from './services/course.service.js';
import { prewarmSkillVectors } from './services/matching.service.js';
import type { HealthStatus } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Application = express();

app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = env.ALLOWED_ORIGINS === '*'
  ? '*'
  : env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.get('/favicon.ico', (_req: Request, res: Response) => {
  res.status(204).end();
});

app.use(rateLimit({
  windowMs: RATE_LIMITS.GENERAL.windowMs,
  max: RATE_LIMITS.GENERAL.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
}));

app.get('/health/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/health/ready', async (_req: Request, res: Response) => {
  const checks: HealthStatus['checks'] = {};

  const dbOk = await testConnection();
  checks.database = dbOk
    ? { status: 'up' }
    : { status: 'down', error: 'Cannot connect to database' };

  const ollamaLatency = await testOllamaHealth();
  checks.ollama = ollamaLatency >= 0
    ? { status: 'up', latencyMs: ollamaLatency }
    : { status: 'down', error: 'Ollama service unreachable' };

  const allUp = Object.values(checks).every((c) => c.status === 'up');

  res.status(allUp ? 200 : 503).json({
    status: allUp ? 'healthy' : 'degraded',
    checks,
    uptime: process.uptime(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'SkillBridge Platform',
    version: '2.0.0',
  });
});

app.use('/api', apiRouter);

app.get([
  '/',
  '/candidate/:id',
  '/student/:id',
  '/profile',
  '/jobs',
  '/courses',
  '/assessments',
  '/quiz',
  '/post-job',
  '/faculty',
  '/recruiter',
  '/analytics',
  '/programs'
], (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
    return;
  }
  next();
});

app.use(errorHandler);

async function start() {
  try {
    await loadSkillCache();
  } catch (err) {
    logger.warn({ err }, 'Failed to load skill cache');
  }

  prewarmCourseCache().catch(() => {});
  prewarmSkillVectors().catch(() => {});

  if (env.NODE_ENV !== 'test') {
    app.listen(env.PORT, () => {
      logger.info(`Server running on http://localhost:${env.PORT}`);
    });
  }
}

start().catch((err) => {
  logger.fatal({ err }, 'Server startup failed');
  process.exit(1);
});

export default app;
