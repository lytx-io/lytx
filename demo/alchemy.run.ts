import type { SiteDurableObject } from "lytx";
import { resolveLytxResourceNames, type LytxResourceStagePosition } from "lytx/resource-names";

import alchemy from "alchemy";
import {
	D1Database,
	KVNamespace,
	DurableObjectNamespace,
	Redwood,
	Queue,
	Worker,
} from "alchemy/cloudflare";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const coreRoot = path.dirname(require.resolve("lytx/package.json"));
const demoRoot = path.dirname(fileURLToPath(import.meta.url));

function stripPersistedSqlFileLists(value: unknown): boolean {
	if (!value || typeof value !== "object") return false;

	let changed = false;
	const record = value as Record<string, unknown>;

	if ("migrationsFiles" in record) {
		delete record.migrationsFiles;
		changed = true;
	}
	if ("importFiles" in record) {
		delete record.importFiles;
		changed = true;
	}

	for (const nestedValue of Object.values(record)) {
		if (stripPersistedSqlFileLists(nestedValue)) {
			changed = true;
		}
	}

	return changed;
}

async function scrubLocalAlchemyMigrationState(appName: string, stage: string) {
	const stateDir = path.join(demoRoot, ".alchemy", appName, stage);

	let entries: string[];
	try {
		entries = await readdir(stateDir);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return;
		}
		throw error;
	}

	for (const entry of entries) {
		if (!entry.endsWith(".json")) continue;

		const filePath = path.join(stateDir, entry);
		const raw = await readFile(filePath, "utf8");
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (!stripPersistedSqlFileLists(parsed)) continue;
		await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
	}
}

const alchemyAppName = process.env.LYTX_APP_NAME ?? "lytx";
const app = await alchemy(alchemyAppName);
if (app.local && app.stage !== "dev") {
	throw new Error(`Refusing local run on non-dev stage: ${app.stage}`);
}

if (app.local) {
	// Alchemy persists migration file metadata without the SQL body, which breaks
	// the next local boot when D1 tries to replay migrations from cached state.
	await scrubLocalAlchemyMigrationState(alchemyAppName, app.stage);
}

const adoptMode = false;
const deleteMode = true;

const _adapter = "durable_object";

const stagePositionRaw = process.env.LYTX_RESOURCE_STAGE_POSITION;
const stagePosition: LytxResourceStagePosition =
	stagePositionRaw === "prefix" || stagePositionRaw === "suffix" || stagePositionRaw === "none"
		? stagePositionRaw
		: "none";

const appDomain = process.env.LYTX_APP_DOMAIN?.trim();
const trackingDomain = process.env.LYTX_TRACKING_DOMAIN?.trim();

const resourceNames = resolveLytxResourceNames({
	stage: app.stage,
	prefix: process.env.LYTX_RESOURCE_PREFIX,
	suffix: process.env.LYTX_RESOURCE_SUFFIX,
	stagePosition,
	overrides: {
		appName: "lytx-demo",
		workerName: "lytx-app",
		durableHostWorkerName: "lytx-app-do-host-demo",
		durableObjectNamespaceName: "site-durable-object-demo",
		d1DatabaseName: "lytx-db-demo",
		eventsKvNamespaceName: "lytx_events-demo",
		configKvNamespaceName: "lytx_config-demo",
		sessionsKvNamespaceName: "lytx_sessions-demo",
		eventsQueueName: "events-queue-demo",
	},
});

const siteDurableObject = DurableObjectNamespace<SiteDurableObject>(resourceNames.durableObjectNamespaceName, {
	className: "SiteDurableObject",
	sqlite: true,
});

const lytxKv = await KVNamespace(resourceNames.eventsKvNamespaceName, {
	adopt: adoptMode,
	delete: deleteMode,
});

const lytx_config = await KVNamespace(resourceNames.configKvNamespaceName, {
	adopt: adoptMode,
	delete: deleteMode,
});

const siteEventsQueue = await Queue(resourceNames.eventsQueueName, {
	name: resourceNames.eventsQueueName,
	adopt: adoptMode,
	delete: deleteMode,
});

const lytx_sessions = await KVNamespace(resourceNames.sessionsKvNamespaceName, {
	adopt: adoptMode,
	delete: deleteMode,
});

const lytxCoreDb = await D1Database(resourceNames.d1DatabaseName, {
	name: resourceNames.d1DatabaseName,
	migrationsDir: `${coreRoot}/db/d1/migrations`,
	adopt: adoptMode,
	delete: deleteMode,
});

const _localDurableHost = app.local
	? await Worker(resourceNames.durableHostWorkerName, {
		entrypoint: `${coreRoot}/endpoints/site_do_worker.ts`,
		bindings: {
			SITE_DURABLE_OBJECT: siteDurableObject,
			lytx_core_db: lytxCoreDb,
			ENVIRONMENT: process.env.ENVIRONMENT ?? "development",
		},
	})
	: undefined;

export const worker = await Redwood(resourceNames.workerName, {
	adopt: false,
	// url: false,
	noBundle: false,
	...(appDomain
		? {
			domains: [
				{
					adopt: adoptMode,
					domainName: appDomain,
				},
			],
		}
		: {}),
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
		LYTX_DOMAIN: trackingDomain || appDomain || process.env.LYTX_DOMAIN || "localhost:5173",
		EMAIL_FROM: process.env.EMAIL_FROM || "noreply@example.com",
		BETTER_AUTH_SECRET: alchemy.secret(process.env.BETTER_AUTH_SECRET),
		GITHUB_CLIENT_SECRET: alchemy.secret(process.env.GITHUB_CLIENT_SECRET),
		GOOGLE_CLIENT_SECRET: alchemy.secret(process.env.GOOGLE_CLIENT_SECRET),
		RESEND_API_KEY: alchemy.secret(process.env.RESEND_API_KEY),
		ENCRYPTION_KEY: alchemy.secret(process.env.ENCRYPTION_KEY),
		AI_API_KEY: alchemy.secret(process.env.AI_API_KEY),
		AI_ACCOUNT_ID: process.env.AI_ACCOUNT_ID ?? "",
		AI_PROVIDER: process.env.AI_PROVIDER ?? "openai",
		SEED_DATA_SECRET: alchemy.secret(process.env.SEED_DATA_SECRET),
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:5173",
		GITHUB_CLIENT_ID: alchemy.secret(process.env.GITHUB_CLIENT_ID),
		GOOGLE_CLIENT_ID: alchemy.secret(process.env.GOOGLE_CLIENT_ID),
		ENVIRONMENT: process.env.ENVIRONMENT ?? "development",
		REPORT_BUILDER: process.env.REPORT_BUILDER ?? "false",
		ASK_AI: process.env.ASK_AI ?? "true",
		LYTX_FEATURE_DASHBOARD: process.env.LYTX_FEATURE_DASHBOARD ?? "true",
		LYTX_FEATURE_EVENTS: process.env.LYTX_FEATURE_EVENTS ?? "true",
		LYTX_FEATURE_AUTH: process.env.LYTX_FEATURE_AUTH ?? "true",
		LYTX_FEATURE_AI: process.env.LYTX_FEATURE_AI ?? "true",
		LYTX_FEATURE_TAG_SCRIPT: process.env.LYTX_FEATURE_TAG_SCRIPT ?? "true",
		AI_BASE_URL: process.env.AI_BASE_URL ?? "",
		AI_MODEL: process.env.AI_MODEL ?? "",
		AI_DAILY_TOKEN_LIMIT: process.env.AI_DAILY_TOKEN_LIMIT ?? "",
	},
});

await app.finalize();
