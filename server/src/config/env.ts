import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root if available
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const databaseUrl = process.env.DATABASE_URL || '';

if (!databaseUrl && nodeEnv !== 'test') {
  console.warn('[AI Studio] Notice: DATABASE_URL is not set. Operating in in-memory store mode.');
}

export const env = {
  PORT: process.env.PORT || '3000',
  NODE_ENV: nodeEnv,
  DATABASE_URL: databaseUrl,
  JWT_SECRET: process.env.JWT_SECRET || 'coding_tracker_secret_key_2026_super_secure_jwt',
  INITIAL_ADMIN_NAME: process.env.INITIAL_ADMIN_NAME || 'System Admin',
  INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL || 'admin@college.edu',
  INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || 'AdminPass123!',
};
