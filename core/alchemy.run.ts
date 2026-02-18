import type { SiteDurableObject } from "./db/durable/siteDurableObject";
import alchemy from "alchemy";
import {
  D1Database,
  KVNamespace,
  DurableObjectNamespace,
  Redwood,
  Queue,
  Worker,
} from "alchemy/cloudflare";
import {
  resolveLytxResourceNames,
  type LytxResourceStagePosition,
} from "./src/config/resourceNames";

const alchemyAppName = process.env.LYTX_APP_NAME ?? "lytx";
const app = await alchemy(alchemyAppName);
if (app.local && app.stage !== "dev") {
  throw new Error(`Refusing local run on non-dev stage: ${app.stage}`);
}

const adoptMode = false;

const stagePositionRaw = process.env.LYTX_RESOURCE_STAGE_POSITION;
const stagePosition: LytxResourceStagePosition =
  stagePositionRaw === "prefix" || stagePositionRaw === "suffix" || stagePositionRaw === "none"
    ? stagePositionRaw
    : "none";

const resourceNames = resolveLytxResourceNames({
  stage: app.stage,
  prefix: process.env.LYTX_RESOURCE_PREFIX,
  suffix: process.env.LYTX_RESOURCE_SUFFIX,
  stagePosition,
  overrides: {
    workerName: process.env.LYTX_WORKER_NAME,
    durableHostWorkerName: process.env.LYTX_DURABLE_HOST_WORKER_NAME,
    durableObjectNamespaceName: process.env.LYTX_DURABLE_OBJECT_NAMESPACE_NAME,
    d1DatabaseName: process.env.LYTX_D1_DATABASE_NAME,
    eventsKvNamespaceName: process.env.LYTX_KV_EVENTS_NAME,
    configKvNamespaceName: process.env.LYTX_KV_CONFIG_NAME,
    sessionsKvNamespaceName: process.env.LYTX_KV_SESSIONS_NAME,
    eventsQueueName: process.env.LYTX_QUEUE_NAME,
  },
});

const siteDurableObject = DurableObjectNamespace<SiteDurableObject>(resourceNames.durableObjectNamespaceName, {
  className: "SiteDurableObject",
  sqlite: true,
});

const lytxKv = await KVNamespace(resourceNames.eventsKvNamespaceName, {
  adopt: adoptMode,
  delete: false,
});

const lytx_config = await KVNamespace(resourceNames.configKvNamespaceName, {
  adopt: adoptMode,
  delete: false,
});

const siteEventsQueue = await Queue(resourceNames.eventsQueueName, {
  name: resourceNames.eventsQueueName,
  adopt: adoptMode,
  delete: false,
});

const lytx_sessions = await KVNamespace(resourceNames.sessionsKvNamespaceName, {
  adopt: adoptMode,
  delete: false,
});

const lytxCoreDb = await D1Database(resourceNames.d1DatabaseName, {
  name: resourceNames.d1DatabaseName,
  migrationsDir: "./db/d1/migrations",
  adopt: adoptMode,
  delete: false,
});

const localDurableHost = app.local
  ? await Worker(resourceNames.durableHostWorkerName, {
      entrypoint: "./endpoints/site_do_worker.ts",
      bindings: {
        SITE_DURABLE_OBJECT: siteDurableObject,
        lytx_core_db: lytxCoreDb,
        ENVIRONMENT: process.env.ENVIRONMENT ?? "development",
      },
    })
  : undefined;

export const worker = await Redwood(resourceNames.workerName, {
  adopt: false,
  url: false,
  noBundle: false,
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
        batchSize: 100,
        maxConcurrency: 4,
        maxRetries: 3,
        maxWaitTimeMs: 20000,
        retryDelay: 30,
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
    ENVIRONMENT: process.env.ENVIRONMENT ?? "development",
    REPORT_BUILDER: process.env.REPORT_BUILDER ?? "false",
    ASK_AI: process.env.ASK_AI ?? "true",
    AI_BASE_URL: process.env.AI_BASE_URL ?? "",
    AI_MODEL: process.env.AI_MODEL ?? "",
    AI_DAILY_TOKEN_LIMIT: process.env.AI_DAILY_TOKEN_LIMIT ?? "",
  },
});

await app.finalize();
