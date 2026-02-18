import { and, eq, gte, lt, sql } from "drizzle-orm";

import { d1_client } from "@db/d1/client";
import { team_ai_usage, type TeamAiUsageInsert } from "@db/d1/schema";

export type TeamAiUsageRequestType = NonNullable<TeamAiUsageInsert["request_type"]>;
export type TeamAiUsageStatus = NonNullable<TeamAiUsageInsert["status"]>;

export type TrackTeamAiUsageInput = {
  team_id: number;
  user_id?: string | null;
  site_id?: number | null;
  request_id?: string | null;
  request_type: TeamAiUsageRequestType;
  provider?: string | null;
  model?: string | null;
  status: TeamAiUsageStatus;
  error_code?: string | null;
  error_message?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  tool_calls?: number | null;
  message_count?: number | null;
  prompt_chars?: number | null;
  completion_chars?: number | null;
  duration_ms?: number | null;
  createdAt?: Date;
};

const toNullableInt = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
};

export async function trackTeamAiUsage(input: TrackTeamAiUsageInput) {
  await d1_client.insert(team_ai_usage).values({
    team_id: input.team_id,
    user_id: input.user_id ?? null,
    site_id: input.site_id ?? null,
    request_id: input.request_id ?? null,
    request_type: input.request_type,
    provider: input.provider ?? null,
    model: input.model ?? null,
    status: input.status,
    error_code: input.error_code ?? null,
    error_message: input.error_message ?? null,
    input_tokens: toNullableInt(input.input_tokens),
    output_tokens: toNullableInt(input.output_tokens),
    total_tokens: toNullableInt(input.total_tokens),
    tool_calls: toNullableInt(input.tool_calls),
    message_count: toNullableInt(input.message_count),
    prompt_chars: toNullableInt(input.prompt_chars),
    completion_chars: toNullableInt(input.completion_chars),
    duration_ms: toNullableInt(input.duration_ms),
    createdAt: input.createdAt ?? new Date(),
  });
}

function getUtcDayWindow(day: Date) {
  const start = new Date(Date.UTC(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    0,
    0,
    0,
    0,
  ));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function getTeamAiUsageForUtcDay(teamId: number, day = new Date()) {
  const { start, end } = getUtcDayWindow(day);

  const [summary] = await d1_client
    .select({
      requestCount: sql<number>`count(*)`,
      inputTokens: sql<number>`coalesce(sum(${team_ai_usage.input_tokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${team_ai_usage.output_tokens}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${team_ai_usage.total_tokens}), 0)`,
    })
    .from(team_ai_usage)
    .where(and(
      eq(team_ai_usage.team_id, teamId),
      eq(team_ai_usage.status, "success"),
      gte(team_ai_usage.createdAt, start),
      lt(team_ai_usage.createdAt, end),
    ));

  return {
    start,
    end,
    requestCount: summary?.requestCount ?? 0,
    inputTokens: summary?.inputTokens ?? 0,
    outputTokens: summary?.outputTokens ?? 0,
    totalTokens: summary?.totalTokens ?? 0,
  };
}
