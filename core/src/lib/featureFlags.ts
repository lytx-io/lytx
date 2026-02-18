import { env } from "cloudflare:workers";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const isEnabled = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return TRUE_VALUES.has(value.trim().toLowerCase());
};

const readRawFlag = (keys: string[]) => {
  const bindingValues = env as unknown as Record<string, string | boolean | undefined>;
  for (const key of keys) {
    if (bindingValues[key] !== undefined) return bindingValues[key];
  }

  const processEnv =
    typeof process !== "undefined"
      ? (process as { env?: Record<string, string | undefined> }).env
      : undefined;

  for (const key of keys) {
    if (processEnv?.[key] !== undefined) return processEnv[key];
  }

  return undefined;
};

const resolveFlag = (keys: string[], defaultValue: boolean) => {
  const raw = readRawFlag(keys);

  if (raw === undefined || raw === null) {
    return defaultValue;
  }

  if (typeof raw === "string" && raw.trim().length === 0) {
    return defaultValue;
  }

  return isEnabled(raw);
};

export const isReportBuilderEnabled = () => {
  return resolveFlag(["REPORT_BUILDER"], false);
};

export const isAskAiEnabled = () => {
  return resolveFlag(["ASK_AI", "ASK_AI_ENABLED"], true);
};

export const isDashboardEnabled = () => {
  return resolveFlag(["LYTX_FEATURE_DASHBOARD", "LYTX_DASHBOARD"], true);
};

export const isEventsEnabled = () => {
  return resolveFlag(["LYTX_FEATURE_EVENTS", "LYTX_EVENTS_ENABLED"], true);
};

export const isAuthEnabled = () => {
  return resolveFlag(["LYTX_FEATURE_AUTH", "LYTX_AUTH_ENABLED"], true);
};

export const isAiFeatureEnabled = () => {
  return resolveFlag(["LYTX_FEATURE_AI", "LYTX_AI_ENABLED"], true);
};

export const isTagScriptEnabled = () => {
  return resolveFlag(["LYTX_FEATURE_TAG_SCRIPT", "LYTX_TAG_SCRIPT_ENABLED"], true);
};
