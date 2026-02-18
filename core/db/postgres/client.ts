import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from 'cloudflare:workers';
const resolveConnectionString = () => {
	const workerEnv = env as unknown as { lytx_pg?: { connectionString?: string } };
	return workerEnv.lytx_pg?.connectionString
		?? process.env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_lytx_pg
		?? process.env.DATABASE_URL
		?? "";
};

export const pg_client = (connextionString = resolveConnectionString()) => {
	return drizzle(connextionString);
}
