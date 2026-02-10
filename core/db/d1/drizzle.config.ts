// import * as dotenv from 'dotenv';
import { defineConfig, type Config } from 'drizzle-kit';
// dotenv.config();
// const mode = process.env.MODE;


export default defineConfig({
	schema: './db/d1/schema.ts',
	out: './db/d1/migrations',
	dialect: 'sqlite',
});

// const config: Config = {
// 	out: './db/d1/migrations',
// 	schema: './db/d1/schema.ts',
// 	dialect: 'sqlite',
//
//
// }
// if (mode == "DEV") {
// 	//@ts-ignore
// 	config.dbCredentials = {
// 		url: process.env.LOCAL_D1!
// 	}
// } else {
// 	//@ts-ignore
// 	config.driver = "d1-http";
// 	//@ts-ignore
// 	config.dbCredentials = {
// 		accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
// 		databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
// 		token: process.env.CLOUDFLARE_D1_TOKEN!,
// 	}
// }
// export default defineConfig(config);
