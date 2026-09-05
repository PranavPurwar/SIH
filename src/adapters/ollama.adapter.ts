import { Ollama } from 'ollama';
import { createCircuitBreaker } from '../lib/circuit-breaker.js';
import { ExternalServiceError } from '../lib/errors.js';
import { EMBEDDING } from '../config/constants.js';
import { env } from '../config/env.js';
import { createChildLogger } from '../lib/logger.js';

const logger = createChildLogger('OllamaAdapter');

export const ollamaClient = new Ollama({
  host: env.OLLAMA_BASE_URL,
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rawEmbedBatch(texts: string[]): Promise<number[][]> {
  const sanitized = texts.map((t) => {
    const trimmed = t.trim();
    if (!trimmed) return '[empty]';
    return trimmed.slice(0, EMBEDDING.MAX_TEXT_LENGTH);
  });

  try {
    const response = await ollamaClient.embed({
      model: env.OLLAMA_EMBED_MODEL,
      input: sanitized,
    });
    return response.embeddings;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err: message, model: env.OLLAMA_EMBED_MODEL }, 'Ollama embed call failed');
    throw new ExternalServiceError('ollama', `Ollama embed failed: ${message}`);
  }
}

async function embedWithRetry(texts: string[], maxRetries = 3): Promise<number[][]> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await rawEmbedBatch(texts);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt - 1) * 1000);
      }
    }
  }

  throw lastError ?? new ExternalServiceError('ollama', 'Embed failed after retries');
}

const breaker = createCircuitBreaker(embedWithRetry, {
  name: 'ollama-embed',
  timeout: 60_000,
  fallback: (texts: string[]) => texts.map(() => new Array(EMBEDDING.DIMENSIONS).fill(0)),
});

export type EmbedMode = 'query' | 'document' | 'raw';

export async function embedBatch(texts: string[], mode: EmbedMode = 'raw'): Promise<number[][]> {
  if (texts.length === 0) return [];

  const prefixed = texts.map((t) => {
    if (mode === 'query') return `${EMBEDDING.QUERY_PREFIX}${t}`;
    if (mode === 'document') return `${EMBEDDING.DOCUMENT_PREFIX}${t}`;
    return t;
  });

  const chunks: string[][] = [];
  for (let i = 0; i < prefixed.length; i += EMBEDDING.MAX_BATCH_SIZE) {
    chunks.push(prefixed.slice(i, i + EMBEDDING.MAX_BATCH_SIZE));
  }

  const chunkResults = await Promise.all(chunks.map((chunk) => breaker.fire(chunk)));
  return chunkResults.flat();
}

export async function testOllamaHealth(): Promise<number> {
  const start = Date.now();
  try {
    await ollamaClient.list();
    return Date.now() - start;
  } catch {
    return -1;
  }
}
