import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

if (!process.env.SUPABASE_URL && process.env.SB_PJ_URL) {
  process.env.SUPABASE_URL = process.env.SB_PJ_URL;
}
if (!process.env.SUPABASE_KEY && process.env.SB_PJ_KEY) {
  process.env.SUPABASE_KEY = process.env.SB_PJ_KEY;
}
if (!process.env.DATABASE_URL && process.env.SB_DB_PASS) {
  process.env.DATABASE_URL = `postgresql://postgres.sbgpronpscarmkxfslvz:${process.env.SB_DB_PASS}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
}

export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  MISTRAL_API_KEY: z.string().min(1),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_EMBED_MODEL: z.string().default('nomic-embed-text-v2-moe'),
  ALLOWED_ORIGINS: z.string().default('*'),
  API_KEY: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Environment validation failed:', result.error.format());
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

export const env: Env = validateEnv();
