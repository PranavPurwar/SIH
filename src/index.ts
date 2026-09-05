import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

declare const Bun: unknown;

import http from 'http';
import { createTerminus, HealthCheckError } from '@godaddy/terminus';

import { env } from './config/env.js';
import { RATE_LIMITS } from './config/constants.js';
import { logger } from './lib/logger.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { testConnection, closeConnections } from './db/connection.js';
import { testOllamaHealth } from './adapters/ollama.adapter.js';
import { getCircuitBreakersHealth, shutdownCircuitBreakers } from './lib/circuit-breaker.js';
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
const clientDir = fs.existsSync(path.join(__dirname, 'client'))
  ? path.join(__dirname, 'client')
  : path.join(__dirname, '../src/client');

// On-the-fly client TypeScript transpilation (no pre-saved public/js files needed)
app.use('/js', async (req: Request, res: Response, next: NextFunction) => {
  if (!req.path.endsWith('.js')) {
    return next();
  }

  const relPath = req.path.replace(/\.js$/, '.ts').replace(/^\//, '');
  const tsFile = path.join(clientDir, relPath);

  if (fs.existsSync(tsFile)) {
    try {
      const code = fs.readFileSync(tsFile, 'utf8');
      let js: string;
      const bunGlobal = typeof Bun !== 'undefined' ? (Bun as Record<string, unknown>) : undefined;
      if (bunGlobal && typeof bunGlobal.Transpiler === 'function') {
        const transpiler = new (bunGlobal.Transpiler as new (opts: { loader: string }) => { transformSync: (s: string) => string })({ loader: 'ts' });
        js = transpiler.transformSync(code);
      } else {
        const ts: any = await import('typescript');
        const tsModule = ts.default || ts;
        js = tsModule.transpileModule(code, {
          compilerOptions: {
            target: tsModule.ScriptTarget?.ES2022 ?? 99,
            module: tsModule.ModuleKind?.ES2022 ?? 7,
          },
        }).outputText;
      }
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(js);
    } catch (err) {
      logger.error({ err, file: tsFile }, 'Failed to transpile client TypeScript on the fly');
      return res.status(500).send(`/* Transpilation error: ${String(err)} */`);
    }
  }

  next();
});

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
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
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

  const circuitBreakers = getCircuitBreakersHealth();
  checks.circuitBreakers = circuitBreakers as any;

  const allUp = dbOk;

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
    circuitBreakers: getCircuitBreakersHealth(),
    uptime: process.uptime(),
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
    const server = http.createServer(app);

    createTerminus(server, {
      healthChecks: {
        '/health/ready': async () => {
          const checks: Record<string, any> = {};

          const dbOk = await testConnection();
          checks.database = dbOk
            ? { status: 'up' }
            : { status: 'down', error: 'Cannot connect to database' };

          const ollamaLatency = await testOllamaHealth();
          checks.ollama = ollamaLatency >= 0
            ? { status: 'up', latencyMs: ollamaLatency }
            : { status: 'down', error: 'Ollama service unreachable' };

          checks.circuitBreakers = getCircuitBreakersHealth();

          if (!dbOk) {
            throw new HealthCheckError('Service degraded: database unreachable', checks);
          }

          return {
            status: 'healthy',
            checks,
            uptime: process.uptime(),
          };
        },
        '/health/live': async () => ({ status: 'ok', uptime: process.uptime() }),
        '/health': async () => ({
          status: 'ok',
          service: 'SkillBridge Platform',
          version: '2.0.0',
          circuitBreakers: getCircuitBreakersHealth(),
          uptime: process.uptime(),
        }),
        verbatim: true,
      },
      timeout: 5000,
      signals: ['SIGTERM', 'SIGINT'],
      onSignal: async () => {
        logger.info('Graceful shutdown initiated: closing connections and circuit breakers...');
        shutdownCircuitBreakers();
        await closeConnections();
        logger.info('Graceful shutdown resource cleanup completed.');
      },
      onShutdown: async () => {
        logger.info('Server successfully shut down.');
      },
      logger: (msg, err) => {
        if (err) logger.error({ err }, msg);
        else logger.info(msg);
      },
    });

    server.listen(env.PORT, () => {
      logger.info(`Server running on http://localhost:${env.PORT}`);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.fatal(`Port ${env.PORT} is already in use by another process. Check with: lsof -i :${env.PORT}`);
      } else {
        logger.fatal({ err }, 'Server encountered an unhandled error');
      }
      process.exit(1);
    });
  }
}

start().catch((err) => {
  logger.fatal({ err }, 'Server startup failed');
  process.exit(1);
});

export default app;
