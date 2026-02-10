import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from 'cloudflare:workers';
export const pg_client = (connextionString = env.lytx_pg.connectionString) => {
	return drizzle(connextionString);
}
