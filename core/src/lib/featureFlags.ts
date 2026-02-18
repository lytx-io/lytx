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

export const isReportBuilderEnabled = () => {
  const raw = readRawFlag(["REPORT_BUILDER"]);
  return isEnabled(raw);
};

export const isAskAiEnabled = () => {
  const raw = readRawFlag(["ASK_AI", "ASK_AI_ENABLED"]);

  if (raw === undefined || raw === null) {
    return true;
  }

  if (typeof raw === "string" && raw.trim().length === 0) {
    return true;
  }

  return isEnabled(raw);
};
