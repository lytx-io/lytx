import { drizzle } from 'drizzle-orm/postgres-js';
// import { env } from 'cloudflare:workers';
export const pg_client = (connectionString: string) => {
	return drizzle(connectionString);
}
