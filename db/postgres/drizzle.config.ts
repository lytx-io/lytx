import { defineConfig } from 'drizzle-kit';

import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  out: './db/postgres/migrations',
  schema: './db/postgres/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL }
});

