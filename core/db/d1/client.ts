import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:workers';

export const d1_client = drizzle(env.lytx_core_db);




