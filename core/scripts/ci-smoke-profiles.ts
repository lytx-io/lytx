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
    tagRoutes: {
      dbAdapter: "sqlite",
      useQueueIngestion: true,
    },
  });

  assert(config.tagRoutes?.dbAdapter === "sqlite", "baseline: expected sqlite adapter");

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
      pathPrefix: "/collect",
      scriptPath: "/lytx.v2.js",
      eventPath: "/trackWebEvent.v2",
      includeLegacyRoutes: false,
      dbAdapter: "sqlite",
      useQueueIngestion: true,
    },
    startupValidation: {
      requireAiEnvWhenAskAiEnabled: false,
    },
  });

  assert(config.tagRoutes?.pathPrefix === "/collect", "customized: expected pathPrefix to be retained");

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

  assert(workerSource.includes('from "@lytx/core"'), "starter: worker must import from @lytx/core root");
  assert(!workerSource.includes('from "@lytx/core/'), "starter: worker must avoid deep @lytx/core imports");

  assert(alchemySource.includes('from "@lytx/core"'), "starter: alchemy file must import from @lytx/core root");
  assert(!alchemySource.includes('from "@lytx/core/'), "starter: alchemy file must avoid deep @lytx/core imports");
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
