import * as dotenv from "dotenv";
import { defineConfig, type Config } from "drizzle-kit";
dotenv.config();

const config: Config = {
  out: "./db/singlestore/migrations",
  schema: "./db/singlestore/schema.ts",
  dialect: "singlestore",
  dbCredentials: {
    host: process.env.SINGLESTORE_HOST!,
    user: process.env.SINGLESTORE_USER!,
    password: process.env.SINGLESTORE_PASSWORD!,
    database: process.env.SINGLESTORE_DATABASE!,
    port: process.env.SINGLESTORE_PORT
      ? parseInt(process.env.SINGLESTORE_PORT)
      : 3306,
  },
};

export default defineConfig(config);
