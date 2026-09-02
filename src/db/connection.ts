import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import { createChildLogger } from '../lib/logger.js';

const logger = createChildLogger('db');

export const supabase: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

export const pgPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  min: 2,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
});

pgPool.on('error', (err) => {
  logger.error({ err }, 'PostgreSQL pool error');
});

export async function testConnection(): Promise<boolean> {
  try {
    await pgPool.query('SELECT 1');
    return true;
  } catch (err) {
    logger.error({ err }, 'Database connection failed');
    return false;
  }
}

export async function closeConnections(): Promise<void> {
  await pgPool.end();
}
