import alchemy from "alchemy";
import { Worker, KVNamespace, D1Database } from "alchemy/cloudflare";

// Environment configuration
const environment = process.env.NODE_ENV || "development";
const stage = process.env.STAGE || environment;

// Environment-specific settings
const envConfig = {
  development: {
    domain: null as string | null, // Use .workers.dev domain
    zone: null as string | null,
    dbName: "lytx-core-db-dev",
    kvSuffix: "-dev",
  },
  staging: {
    domain: process.env.STAGING_DOMAIN || null, // e.g., "staging.yourdomain.com"
    zone: process.env.STAGING_ZONE || null, // e.g., "yourdomain.com"
    dbName: "lytx-core-db-staging",
    kvSuffix: "-staging",
  },
  production: {
    domain: process.env.PRODUCTION_DOMAIN || null, // e.g., "app.yourdomain.com"
    zone: process.env.PRODUCTION_ZONE || null, // e.g., "yourdomain.com"
    dbName: "lytx-core-db",
    kvSuffix: "",
  },
} as const;

type Environment = keyof typeof envConfig;
const config = envConfig[stage as Environment] || envConfig.development;

const app = await alchemy(`lytx-kit-${stage}`);

// Create D1 database
export const database = await D1Database("lytx-core-db", {
  name: config.dbName,
});

// Create KV namespaces with environment-specific naming
export const eventsKV = await KVNamespace("lytx-events", {
  title: `LYTX_EVENTS${config.kvSuffix}`,
});

export const configKV = await KVNamespace("lytx-config", {
  title: `lytx_config${config.kvSuffix}`,
});

export const sessionsKV = await KVNamespace("lytx-sessions", {
  title: `lytx_sessions${config.kvSuffix}`,
});

// Worker configuration with environment-specific routes
const workerConfig: any = {
  entrypoint: "./src/worker.tsx",
  bindings: {
    // Database binding
    DB: database,

    // KV namespace bindings
    LYTX_EVENTS: eventsKV,
    lytx_config: configKV,
    lytx_sessions: sessionsKV,

    // Environment variables
    NODE_ENV: environment,
    STAGE: stage,

    // Secrets (use alchemy.secret() for sensitive values)
    // DATABASE_URL: alchemy.secret(process.env.DATABASE_URL),
    // JWT_SECRET: alchemy.secret(process.env.JWT_SECRET),
  },
  url: true,
};

// Add custom domain routes if configured
if (config.domain && config.zone) {
  workerConfig.routes = [
    {
      pattern: `${config.domain}/*`,
      zone: config.zone,
    },
  ];
}

// Create the main worker
export const worker = await Worker("lytx-kit-worker", workerConfig);

// Auto-run database migrations after D1 database is created
if (stage !== "production") {
  console.log("🔄 Running database migrations...");
  try {
    const { spawn } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(spawn);

    await execAsync("bun", ["run", "db:migrate:local"], {
      stdio: "inherit",
      shell: true,
    });

    console.log("✅ Database migrations completed");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("⚠️  Database migration failed:", errorMessage);
    console.warn("   You may need to run migrations manually:");
    console.warn(
      `   ${stage === "development" ? "bun run db:migrate:local" : `bun run db:migrate --env ${stage}`}`,
    );
  }
}

console.log({
  environment: stage,
  workerUrl: worker.url,
  customDomain: config.domain || "Using .workers.dev domain",
  database: {
    name: database.name,
    binding: "DB",
  },
  kvNamespaces: {
    events: eventsKV.title,
    config: configKV.title,
    sessions: sessionsKV.title,
  },
});

// Always call finalize to clean up orphaned resources
await app.finalize();
