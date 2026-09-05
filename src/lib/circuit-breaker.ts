import CircuitBreaker from 'opossum';
import { CIRCUIT_BREAKER } from '../config/constants.js';
import { createChildLogger } from './logger.js';

const logger = createChildLogger('circuit-breaker');

const registry = new Map<string, CircuitBreaker<any, any>>();

export function createCircuitBreaker<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    name: string;
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
    volumeThreshold?: number;
    fallback?: (...args: TArgs) => TResult | Promise<TResult>;
  }
): CircuitBreaker<TArgs, TResult> {
  const breaker = new CircuitBreaker(fn, {
    timeout: options.timeout ?? CIRCUIT_BREAKER.TIMEOUT,
    errorThresholdPercentage: options.errorThresholdPercentage ?? CIRCUIT_BREAKER.ERROR_THRESHOLD,
    resetTimeout: options.resetTimeout ?? CIRCUIT_BREAKER.RESET_TIMEOUT,
    volumeThreshold: options.volumeThreshold ?? CIRCUIT_BREAKER.VOLUME_THRESHOLD,
    name: options.name,
  });

  if (options.fallback) {
    breaker.fallback(options.fallback);
  }

  // Attach lifecycle telemetry & events
  breaker.on('open', () => {
    logger.warn({ breaker: options.name }, `Circuit breaker OPENED - calls will fail fast or use fallback`);
  });

  breaker.on('close', () => {
    logger.info({ breaker: options.name }, `Circuit breaker CLOSED - downstream service healthy`);
  });

  breaker.on('halfOpen', () => {
    logger.info({ breaker: options.name }, `Circuit breaker HALF-OPEN - probing downstream health`);
  });

  breaker.on('fallback', (_result, err) => {
    logger.warn({ breaker: options.name, err: err?.message }, `Circuit breaker executed fallback`);
  });

  breaker.on('reject', () => {
    logger.warn({ breaker: options.name }, `Circuit breaker REJECTED call while open`);
  });

  breaker.on('timeout', () => {
    logger.warn({ breaker: options.name }, `Circuit breaker operation TIMED OUT`);
  });

  breaker.on('failure', (err) => {
    logger.error({ breaker: options.name, err: err?.message }, `Circuit breaker recorded failure`);
  });

  registry.set(options.name, breaker);

  return breaker;
}

export function getCircuitBreaker(name: string): CircuitBreaker<any, any> | undefined {
  return registry.get(name);
}

export function getAllCircuitBreakers(): Map<string, CircuitBreaker<any, any>> {
  return registry;
}

export function getCircuitBreakersHealth(): Record<string, { status: 'healthy' | 'open' | 'half-open'; opened: boolean; stats: any }> {
  const summary: Record<string, { status: 'healthy' | 'open' | 'half-open'; opened: boolean; stats: any }> = {};
  for (const [name, breaker] of registry.entries()) {
    let status: 'healthy' | 'open' | 'half-open' = 'healthy';
    if (breaker.opened) status = 'open';
    else if (breaker.halfOpen) status = 'half-open';

    summary[name] = {
      status,
      opened: breaker.opened,
      stats: {
        fires: breaker.stats.fires,
        failures: breaker.stats.failures,
        successes: breaker.stats.successes,
        rejects: breaker.stats.rejects,
        timeouts: breaker.stats.timeouts,
        fallbacks: breaker.stats.fallbacks,
      }
    };
  }
  return summary;
}

export function shutdownCircuitBreakers(): void {
  for (const [name, breaker] of registry.entries()) {
    try {
      breaker.shutdown();
      logger.info({ breaker: name }, 'Circuit breaker cleanly shut down');
    } catch (err) {
      logger.error({ breaker: name, err }, 'Error shutting down circuit breaker');
    }
  }
}

