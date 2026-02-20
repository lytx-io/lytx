#!/usr/bin/env bun
//
// Lytx Kit – Interactive Setup
//
// Generates alchemy.run.ts and .env for deploying Lytx on your own
// Cloudflare account. Run with:
//
//   bun run cli/setup.ts
//   bun run cli/setup.ts --non-interactive   (use all defaults)
//

import { existsSync, writeFileSync, readFileSync } from "fs";
import { resolve } from "path";
import { createInterface } from "readline";

// ---------------------------------------------------------------------------
// Defaults — match what the reference alchemy.run.ts uses
// ---------------------------------------------------------------------------

interface SetupConfig {
  appName: string;
  workerName: string;
  domains: string[];
  apiWorkerEnabled: boolean;
  apiWorkerName: string;
  apiWorkerDomain: string;
  apiWorkerPort: number;
  d1Name: string;
  kvEvents: string;
  kvConfig: string;
  kvSessions: string;
  queueName: string;
  doName: string;
  adoptMode: boolean;
  queueBatchSize: number;
  queueMaxConcurrency: number;
  queueMaxRetries: number;
  queueMaxWaitTimeMs: number;
  queueRetryDelay: number;
}

const DEFAULTS: SetupConfig = {
  appName: "lytx",
  workerName: "lytx-app",
  domains: [],
  apiWorkerEnabled: false,
  apiWorkerName: "lytx-api",
  apiWorkerDomain: "",
  apiWorkerPort: 8788,
  d1Name: "lytx-core-db",
  kvEvents: "LYTX_EVENTS",
  kvConfig: "lytx_config",
  kvSessions: "lytx_sessions",
  queueName: "site-events-queue",
  doName: "site-durable-object",
  adoptMode: false,
  queueBatchSize: 100,
  queueMaxConcurrency: 4,
  queueMaxRetries: 3,
  queueMaxWaitTimeMs: 20_000,
  queueRetryDelay: 30,
};

// ---------------------------------------------------------------------------
// Prompt helper
// ---------------------------------------------------------------------------

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string, fallback: string): Promise<string> {
  const label = fallback ? ` (${fallback})` : "";
  return new Promise((resolve) => {
    rl.question(`${question}${label}: `, (answer) => {
      resolve(answer.trim() || fallback);
    });
  });
}

async function askBool(question: string, fallback: boolean): Promise<boolean> {
  const hint = fallback ? "Y/n" : "y/N";
  const answer = await ask(`${question} [${hint}]`, "");
  if (!answer) return fallback;
  return answer.toLowerCase().startsWith("y");
}

async function askNumber(question: string, fallback: number): Promise<number> {
  const raw = await ask(question, String(fallback));
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function askList(question: string, hint: string): Promise<string[]> {
  const raw = await ask(`${question} (${hint})`, "");
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

async function promptConfig(): Promise<SetupConfig> {
  const config = { ...DEFAULTS };

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║         Lytx Kit – Setup Wizard          ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // -- Core identity --
  console.log("── Project ────────────────────────────────\n");
  config.appName = await ask("Alchemy app name", config.appName);
  config.workerName = await ask("Main worker name", config.workerName);

  // -- Domains --
  console.log("\n── Domains ────────────────────────────────\n");
  console.log("  Add custom domains Cloudflare will route to this worker.");
  console.log("  Leave blank for workers.dev only (you can add domains later).\n");
  config.domains = await askList("Custom domains", "comma-separated, e.g. analytics.example.com");

  // -- API Worker --
  console.log("\n── API Worker (optional) ──────────────────\n");
  console.log("  A separate Worker that exposes the Lytx REST API on its own");
  console.log("  domain/subdomain. Skip this if you only need the main app.\n");
  config.apiWorkerEnabled = await askBool("Deploy a separate API worker?", config.apiWorkerEnabled);
  if (config.apiWorkerEnabled) {
    config.apiWorkerName = await ask("  API worker name", config.apiWorkerName);
    config.apiWorkerDomain = await ask("  API worker domain", "api.example.com");
    config.apiWorkerPort = await askNumber("  Local dev port", config.apiWorkerPort);
  }

  // -- Cloudflare resources --
  console.log("\n── Cloudflare Resources ───────────────────\n");
  config.d1Name = await ask("D1 database name", config.d1Name);
  config.kvEvents = await ask("KV namespace – events", config.kvEvents);
  config.kvConfig = await ask("KV namespace – config", config.kvConfig);
  config.kvSessions = await ask("KV namespace – sessions", config.kvSessions);
  config.queueName = await ask("Queue name", config.queueName);
  config.doName = await ask("Durable Object namespace", config.doName);

  // -- Adopt mode --
  console.log("\n── Resource Mode ─────────────────────────\n");
  console.log("  Adopt mode tells Alchemy to adopt existing Cloudflare");
  console.log("  resources instead of creating new ones. Turn this on if");
  console.log("  you already created resources via wrangler or the dashboard.\n");
  config.adoptMode = await askBool("Enable adopt mode?", config.adoptMode);

  // -- Queue tuning --
  console.log("\n── Queue Settings ─────────────────────────\n");
  const tuneQueue = await askBool("Customize queue settings?", false);
  if (tuneQueue) {
    config.queueBatchSize = await askNumber("  Batch size", config.queueBatchSize);
    config.queueMaxConcurrency = await askNumber("  Max concurrency", config.queueMaxConcurrency);
    config.queueMaxRetries = await askNumber("  Max retries", config.queueMaxRetries);
    config.queueMaxWaitTimeMs = await askNumber("  Max wait time (ms)", config.queueMaxWaitTimeMs);
    config.queueRetryDelay = await askNumber("  Retry delay (s)", config.queueRetryDelay);
  }

  return config;
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

function generateAlchemyRunTs(c: SetupConfig): string {
  const adopt = c.adoptMode ? "true" : "false";

  const domainsBlock =
    c.domains.length > 0
      ? c.domains
          .map(
            (d) =>
              `  {\n    adopt: ${adopt},\n    domainName: "${d}",\n  }`,
          )
          .join(",\n")
      : "";

  const domainsProperty = domainsBlock
    ? `\n  domains: [\n${domainsBlock},\n  ],`
    : "";

  const apiWorkerBlock = c.apiWorkerEnabled
    ? `
await Worker("${c.apiWorkerName}", {
  entrypoint: "./endpoints/api_worker.tsx",
  dev: {
    port: ${c.apiWorkerPort},
  },
  url: false,
  adopt: ${adopt},${
    c.apiWorkerDomain
      ? `\n  domains: [{\n    adopt: ${adopt},\n    domainName: "${c.apiWorkerDomain}",\n  }],`
      : ""
  }
  bindings: {
    STORAGE:
      app.local && localDurableHost
        ? localDurableHost.bindings.SITE_DURABLE_OBJECT
        : worker.bindings.SITE_DURABLE_OBJECT,
    lytx_core_db: lytxCoreDb,
    ENVIRONMENT: process.env.ENVIRONMENT ?? "development",
  },
});
`
    : "";

  return `import type { SiteDurableObject } from "./db/durable/siteDurableObject";
import alchemy from "alchemy";
import {
  D1Database,
  KVNamespace,
  DurableObjectNamespace,
  Redwood,
  Queue,
  Worker,
} from "alchemy/cloudflare";

const app = await alchemy("${c.appName}");
if (app.local && app.stage !== "dev") {
  throw new Error(\`Refusing local run on non-dev stage: \${app.stage}\`);
}

const adoptMode = ${adopt};

const siteDurableObject = DurableObjectNamespace<SiteDurableObject>("${c.doName}", {
  className: "SiteDurableObject",
  sqlite: true,
});

const lytxKv = await KVNamespace("${c.kvEvents}", {
  adopt: adoptMode,
  delete: false,
});

const lytx_config = await KVNamespace("${c.kvConfig}", {
  adopt: adoptMode,
  delete: false,
});

const siteEventsQueue = await Queue("${c.queueName}", {
  name: "${c.queueName}",
  adopt: adoptMode,
  delete: false,
});

const lytx_sessions = await KVNamespace("${c.kvSessions}", {
  adopt: adoptMode,
  delete: false,
});

const lytxCoreDb = await D1Database("${c.d1Name}", {
  name: "${c.d1Name}",
  migrationsDir: "./db/d1/migrations",
  adopt: adoptMode,
  delete: false,
});

const localDurableHost = app.local
  ? await Worker("${c.workerName}-do-host", {
      entrypoint: "./endpoints/site_do_worker.ts",
      bindings: {
        SITE_DURABLE_OBJECT: siteDurableObject,
        lytx_core_db: lytxCoreDb,
        ENVIRONMENT: process.env.ENVIRONMENT ?? "development",
      },
    })
  : undefined;

export const worker = await Redwood("${c.workerName}", {
  adopt: ${adopt},
  url: false,
  noBundle: false,${domainsProperty}
  wrangler: {
    main: "src/worker.tsx",
    transform: (spec) => ({
      ...spec,
      compatibility_flags: ["nodejs_compat"],
    }),
  },
  eventSources: [
    {
      queue: siteEventsQueue,
      settings: {
        batchSize: ${c.queueBatchSize},
        maxConcurrency: ${c.queueMaxConcurrency},
        maxRetries: ${c.queueMaxRetries},
        maxWaitTimeMs: ${c.queueMaxWaitTimeMs},
        retryDelay: ${c.queueRetryDelay},
      },
    },
  ],
  bindings: {
    SITE_DURABLE_OBJECT: siteDurableObject,
    LYTX_EVENTS: lytxKv,
    lytx_config: lytx_config,
    lytx_sessions: lytx_sessions,
    lytx_core_db: lytxCoreDb,
    SITE_EVENTS_QUEUE: siteEventsQueue,
    LYTX_DOMAIN: process.env.LYTX_DOMAIN || "localhost:5173",
    EMAIL_FROM: process.env.EMAIL_FROM || "noreply@example.com",
    BETTER_AUTH_SECRET: alchemy.secret(process.env.BETTER_AUTH_SECRET),
    GITHUB_CLIENT_SECRET: alchemy.secret(process.env.GITHUB_CLIENT_SECRET),
    GOOGLE_CLIENT_SECRET: alchemy.secret(process.env.GOOGLE_CLIENT_SECRET),
    RESEND_API_KEY: alchemy.secret(process.env.RESEND_API_KEY),
    ENCRYPTION_KEY: alchemy.secret(process.env.ENCRYPTION_KEY),
    AI_API_KEY: alchemy.secret(process.env.AI_API_KEY),
    SEED_DATA_SECRET: alchemy.secret(process.env.SEED_DATA_SECRET),
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GITHUB_CLIENT_ID: alchemy.secret(process.env.GITHUB_CLIENT_ID),
    GOOGLE_CLIENT_ID: alchemy.secret(process.env.GOOGLE_CLIENT_ID),
    REPORT_BUILDER: process.env.REPORT_BUILDER || "false",
    ASK_AI: process.env.ASK_AI || "true",
    ENVIRONMENT: process.env.ENVIRONMENT ?? "development",
    AI_BASE_URL: process.env.AI_BASE_URL ?? "",
    AI_MODEL: process.env.AI_MODEL ?? "",
    AI_DAILY_TOKEN_LIMIT: process.env.AI_DAILY_TOKEN_LIMIT ?? "",
  },
});
${apiWorkerBlock}
await app.finalize();
`;
}

function generateEnvFile(c: SetupConfig): string {
  const domain =
    c.domains.length > 0 ? c.domains[0] : "localhost:5173";

  return `# ── Lytx – Generated by \`bun run cli/setup.ts\` ──

# Domain that appears in emails and auth callbacks
LYTX_DOMAIN=${domain}

# Auth (required)
BETTER_AUTH_SECRET=change-me-${crypto.randomUUID().slice(0, 8)}
BETTER_AUTH_URL=http://localhost:5173
ENCRYPTION_KEY=change-me-${crypto.randomUUID().slice(0, 8)}

# Auth providers (optional – fill in to enable)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email via Resend (optional)
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com

# AI features (optional)
AI_API_KEY=
AI_ACCOUNT_ID=
AI_PROVIDER=openai
AI_BASE_URL=
AI_MODEL=
AI_DAILY_TOKEN_LIMIT=
REPORT_BUILDER=false
ASK_AI=true

# Misc
SEED_DATA_SECRET=change-me-${crypto.randomUUID().slice(0, 8)}
ENVIRONMENT=development
`;
}

// ---------------------------------------------------------------------------
// File writing with backup
// ---------------------------------------------------------------------------

function safeWrite(filePath: string, content: string, label: string): void {
  const fullPath = resolve(filePath);
  if (existsSync(fullPath)) {
    const backupPath = `${fullPath}.bak`;
    const existing = readFileSync(fullPath, "utf-8");
    writeFileSync(backupPath, existing, "utf-8");
    console.log(`  ⚠  Backed up existing ${label} → ${filePath}.bak`);
  }
  writeFileSync(fullPath, content, "utf-8");
  console.log(`  ✓  Wrote ${label} → ${filePath}`);
}

// ---------------------------------------------------------------------------
// Config file (lytx.config.json) for re-running setup
// ---------------------------------------------------------------------------

const CONFIG_PATH = "lytx.config.json";

function saveSetupConfig(c: SetupConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2) + "\n", "utf-8");
  console.log(`  ✓  Saved setup config → ${CONFIG_PATH}`);
}

function loadSetupConfig(): SetupConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as SetupConfig;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const nonInteractive = args.includes("--non-interactive") || args.includes("-y");
  const regenOnly = args.includes("--regen");

  let config: SetupConfig;

  if (regenOnly) {
    const saved = loadSetupConfig();
    if (!saved) {
      console.error("No lytx.config.json found. Run setup interactively first.");
      process.exit(1);
    }
    config = saved;
    console.log("\nRegenerating from saved lytx.config.json...\n");
  } else if (nonInteractive) {
    const saved = loadSetupConfig();
    config = saved ?? { ...DEFAULTS };
    console.log("\nUsing defaults (non-interactive mode)...\n");
  } else {
    config = await promptConfig();
  }

  rl.close();

  console.log("\n── Writing files ─────────────────────────\n");

  safeWrite("alchemy.run.ts", generateAlchemyRunTs(config), "alchemy.run.ts");

  if (!existsSync(".env")) {
    safeWrite(".env", generateEnvFile(config), ".env");
  } else {
    console.log("  ·  .env already exists, skipping (won't overwrite secrets)");
  }

  saveSetupConfig(config);

  console.log(`
── Done! ──────────────────────────────────

Next steps:

  1. Review and fill in secrets in .env
  2. Install dependencies:     bun install
  3. Run locally:              bun run dev
  4. Deploy to Cloudflare:     bun run deploy

Re-run this wizard anytime:
  bun run cli/setup.ts

Regenerate files from saved config:
  bun run cli/setup.ts --regen
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
