import type { SiteDurableObject } from "@lytx/core/db/durable/siteDurableObject";

import alchemy from "alchemy";
import {
	D1Database,
	KVNamespace,
	DurableObjectNamespace,
	Redwood,
	Queue,
	Worker,
} from "alchemy/cloudflare";

const app = await alchemy("lytx");
if (app.local && app.stage !== "dev") {
	throw new Error(`Refusing local run on non-dev stage: ${app.stage}`);
}

const adoptMode = false;
const deleteMode = true;
const repo_path = "../core";

const adapter = "durable_object";

const siteDurableObject = DurableObjectNamespace<SiteDurableObject>("site-durable-object", {
	className: "SiteDurableObject",
	sqlite: true,
});

const lytxKv = await KVNamespace("LYTX_EVENTS", {
	adopt: adoptMode,
	delete: deleteMode,
});

const lytx_config = await KVNamespace("lytx_config", {
	adopt: adoptMode,
	delete: deleteMode,
});

const siteEventsQueue = await Queue("site-events-queue", {
	name: "site-events-queue",
	adopt: adoptMode,
	delete: deleteMode,
});

const lytx_sessions = await KVNamespace("lytx_sessions", {
	adopt: adoptMode,
	delete: deleteMode,
});

const lytxCoreDb = await D1Database("lytx-core-db", {
	name: "lytx-core-db",
	migrationsDir: `${repo_path}/db/d1/migrations`,
	adopt: adoptMode,
	delete: deleteMode,
});

const localDurableHost = app.local
	? await Worker("lytx-app-do-host", {
		entrypoint: `${repo_path}/endpoints/site_do_worker.ts`,
		bindings: {
			SITE_DURABLE_OBJECT: siteDurableObject,
			lytx_core_db: lytxCoreDb,
			ENVIRONMENT: process.env.ENVIRONMENT ?? "development",
		},
	})
	: undefined;

export const worker = await Redwood("lytx-app", {
	adopt: false,
	// url: false,
	noBundle: false,
	dev: {
		command: "rm -rf ./node_modules/.vite && bun run vite dev",
	},
	wrangler: {
		main: "./src/worker.tsx",
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
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:5173",
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
