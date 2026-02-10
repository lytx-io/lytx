import { drizzle } from 'drizzle-orm/postgres-js';
export const pg_client = (connextionString = process.env.DATABASE_URL) => {
  return drizzle(connextionString, { logger: true });
}
