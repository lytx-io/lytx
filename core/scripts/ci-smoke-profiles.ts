import { readFileSync } from "node:fs";
import path from "node:path";

import { parseCreateLytxAppConfig } from "../src/config/createLytxAppConfig";
import { resolveLytxResourceNames } from "../src/config/resourceNames";

type Profile = "baseline" | "customized";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function runBaselineChecks() {
  const config = parseCreateLytxAppConfig({
    dbAdapter: "sqlite",
    useQueueIngestion: true,
  });

  assert(config.dbAdapter === "sqlite", "baseline: expected sqlite adapter");

  const namesA = resolveLytxResourceNames({
    stage: "dev",
    stagePosition: "none",
  });
  const namesB = resolveLytxResourceNames({
    stage: "dev",
    stagePosition: "none",
  });

  assert(
    JSON.stringify(namesA) === JSON.stringify(namesB),
    "baseline: naming strategy must be deterministic",
  );
}

function runCustomizedChecks() {
  const config = parseCreateLytxAppConfig({
    features: {
      dashboard: true,
      events: true,
      auth: true,
      ai: true,
      reportBuilderEnabled: true,
      askAiEnabled: true,
    },
    tagRoutes: {
      scriptPath: "/lytx.v2.js",
      eventPath: "/trackWebEvent.v2",
    },
    dbAdapter: "sqlite",
    useQueueIngestion: true,
    includeLegacyTagRoutes: false,
    trackingRoutePrefix: "/collect",
    auth: {
      socialProviders: {
        google: false,
        github: false,
      },
    },
    startupValidation: {
      requireAiEnvWhenAskAiEnabled: false,
    },
  });

  assert(config.trackingRoutePrefix === "/collect", "customized: expected route prefix to be retained");

  const names = resolveLytxResourceNames({
    stage: "prod",
    prefix: "customer-a",
    suffix: "v2",
    stagePosition: "suffix",
    overrides: {
      eventsQueueName: "events-main",
    },
  });

  assert(
    names.d1DatabaseName === "customer-a-lytx-core-db-prod-v2",
    "customized: expected stage+prefix+suffix D1 name",
  );
  assert(names.eventsQueueName === "events-main", "customized: expected queue override to win");
}

function verifyStarterImports() {
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const workerPath = path.join(repoRoot, "demo/src/worker.tsx");
  const alchemyPath = path.join(repoRoot, "demo/alchemy.run.ts");

  const workerSource = readFileSync(workerPath, "utf8");
  const alchemySource = readFileSync(alchemyPath, "utf8");

  const allowedSubpaths = new Set(["resource-names"]);
  const extractCoreSubpaths = (source: string) => {
    const matches = source.matchAll(/from\s+["']lytx\/([^"']+)["']/g);
    return Array.from(matches, (match) => match[1]);
  };

  assert(workerSource.includes('from "lytx"'), "starter: worker must import from lytx root");
  assert(extractCoreSubpaths(workerSource).length === 0, "starter: worker must avoid lytx subpath imports");

  assert(alchemySource.includes('from "lytx"'), "starter: alchemy file must import from lytx root");
  for (const subpath of extractCoreSubpaths(alchemySource)) {
    assert(
      allowedSubpaths.has(subpath),
      `starter: alchemy file uses unsupported lytx subpath import: ${subpath}`,
    );
  }
}

function main() {
  const rawProfile = (process.argv[2] ?? "baseline") as Profile;
  const profile: Profile = rawProfile === "customized" ? "customized" : "baseline";

  verifyStarterImports();

  if (profile === "baseline") {
    runBaselineChecks();
  } else {
    runCustomizedChecks();
  }

  console.log(`OSS smoke profile passed: ${profile}`);
}

main();
