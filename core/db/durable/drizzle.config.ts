import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './db/durable/migrations',
  schema: './db/durable/schema.ts',
  dialect: 'sqlite',
  driver: 'durable-sqlite',
});
