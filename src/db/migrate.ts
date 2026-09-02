import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pgPool } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
  const schemaPath = fs.existsSync(path.join(__dirname, 'schema.sql'))
    ? path.join(__dirname, 'schema.sql')
    : path.join(__dirname, '../../src/db/schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');
  console.log('Applying database schema from schema.sql...');
  await pgPool.query(sql);
  console.log('✓ Database schema applied successfully.');
}

async function main() {
  try {
    console.log('Starting database setup...');
    await setupDatabase();
    console.log('Database initialization complete.');
  } catch (err) {
    console.error('Database setup failed:', err);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

main();
