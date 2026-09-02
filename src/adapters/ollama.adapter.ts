import { createCircuitBreaker } from '../lib/circuit-breaker.js';
import { ExternalServiceError } from '../lib/errors.js';
import { EMBEDDING } from '../config/constants.js';
import { env } from '../config/env.js';

interface EmbedResponse {
  embeddings: number[][];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rawEmbedBatch(texts: string[]): Promise<number[][]> {
  const sanitized = texts.map((t) => {
    const trimmed = t.trim();
    if (!trimmed) return '[empty]';
    return trimmed.slice(0, EMBEDDING.MAX_TEXT_LENGTH);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_EMBED_MODEL,
        input: sanitized,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ExternalServiceError('ollama', `Embed error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as EmbedResponse;
    return data.embeddings;
  } finally {
    clearTimeout(timeout);
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
    await rawEmbedBatch(['health check']);
    return Date.now() - start;
  } catch {
    return -1;
  }
}
