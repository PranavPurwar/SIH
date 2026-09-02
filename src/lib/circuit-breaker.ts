import CircuitBreaker from 'opossum';
import { CIRCUIT_BREAKER } from '../config/constants.js';

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

  return breaker;
}
