export type LytxResourceStagePosition = "prefix" | "suffix" | "none";

export type LytxResourceNames = {
  appName: string;
  workerName: string;
  durableHostWorkerName: string;
  durableObjectNamespaceName: string;
  d1DatabaseName: string;
  eventsKvNamespaceName: string;
  configKvNamespaceName: string;
  sessionsKvNamespaceName: string;
  eventsQueueName: string;
};

export type LytxResourceNamingOptions = {
  prefix?: string;
  suffix?: string;
  stage?: string;
  stagePosition?: LytxResourceStagePosition;
  separator?: "-" | "_";
  overrides?: Partial<LytxResourceNames>;
};

export const DEFAULT_LYTX_RESOURCE_NAMES: LytxResourceNames = {
  appName: "lytx",
  workerName: "lytx-app",
  durableHostWorkerName: "lytx-app-do-host",
  durableObjectNamespaceName: "site-durable-object",
  d1DatabaseName: "lytx-core-db",
  eventsKvNamespaceName: "LYTX_EVENTS",
  configKvNamespaceName: "lytx_config",
  sessionsKvNamespaceName: "lytx_sessions",
  eventsQueueName: "site-events-queue",
};

function normalizeSegment(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/[-_]{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function joinSegments(segments: Array<string | undefined>, separator: "-" | "_"): string {
  const normalized = segments
    .map((segment) => (segment ? normalizeSegment(segment) : ""))
    .filter((segment) => segment.length > 0);
  return normalized.join(separator);
}

export function resolveLytxResourceNames(
  options: LytxResourceNamingOptions = {},
): LytxResourceNames {
  const separator = options.separator ?? "-";
  const stagePosition = options.stagePosition ?? "none";
  const stage_segment = options.stage ? normalizeSegment(options.stage) : "";
  const prefix_segment = options.prefix ? normalizeSegment(options.prefix) : "";
  const suffix_segment = options.suffix ? normalizeSegment(options.suffix) : "";

  const withStrategy = (base: string): string => {
    if (stagePosition === "prefix") {
      return joinSegments([prefix_segment, stage_segment, base, suffix_segment], separator);
    }
    if (stagePosition === "suffix") {
      return joinSegments([prefix_segment, base, stage_segment, suffix_segment], separator);
    }
    return joinSegments([prefix_segment, base, suffix_segment], separator);
  };

  const resolved: LytxResourceNames = {
    ...DEFAULT_LYTX_RESOURCE_NAMES,
  };

  for (const [key, default_name] of Object.entries(DEFAULT_LYTX_RESOURCE_NAMES) as Array<
    [keyof LytxResourceNames, string]
  >) {
    const override = options.overrides?.[key];
    if (override) {
      resolved[key] = normalizeSegment(override);
    } else {
      const strategy_name = withStrategy(default_name);
      resolved[key] = strategy_name.length > 0 ? strategy_name : default_name;
    }
  }

  return resolved;
}
