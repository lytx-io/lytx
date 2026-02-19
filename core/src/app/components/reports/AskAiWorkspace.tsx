"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { ResponsivePie } from "@nivo/pie";
import { Button } from "@/app/components/ui/Button";
import { AuthContext } from "@/app/providers/AuthProvider";
import { useTheme } from "@/app/providers/ThemeProvider";
import { createChartTheme } from "@/app/utils/chartThemes";

type AskAiWorkspaceProps = {
  initialAiConfigured: boolean;
  initialAiModel: string;
};

type AiChartPoint = {
  x: string;
  y: number;
};

type AiNivoChartOutput = {
  kind: "nivo-chart";
  chartType: "bar" | "line" | "pie";
  title: string;
  metricType?: string;
  siteId: number;
  dateRange?: {
    start?: string;
    end?: string;
  };
  points: AiChartPoint[];
};

const truncateAxisLabel = (value: unknown, max = 20) => {
  const label = String(value ?? "").trim();
  if (label.length <= max) return label;
  return `${label.slice(0, max - 3)}...`;
};

function isAiNivoChartOutput(value: unknown): value is AiNivoChartOutput {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AiNivoChartOutput>;
  const chartType = candidate.chartType;
  return candidate.kind === "nivo-chart"
    && (chartType === "bar" || chartType === "line" || chartType === "pie")
    && Array.isArray(candidate.points);
}

function getMessageText(parts: Array<unknown>) {
  return parts
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const candidate = part as { type?: string; text?: string };
      return candidate.type === "text" && typeof candidate.text === "string" ? candidate.text : "";
    })
    .join("");
}

function getChartOutput(parts: Array<unknown>): AiNivoChartOutput | null {
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const candidate = part as { state?: string; output?: unknown };
    if (candidate.state !== "output-available") continue;
    if (isAiNivoChartOutput(candidate.output)) {
      return candidate.output;
    }
  }

  return null;
}

function getChartFallbackSummary(chart: AiNivoChartOutput) {
  const points = chart.points
    .map((point) => ({ x: String(point.x ?? "Unknown"), y: Number(point.y) || 0 }))
    .filter((point) => point.x.length > 0)
    .toSorted((a, b) => b.y - a.y);

  if (points.length === 0) {
    return `Here is your ${chart.chartType} chart for ${chart.title}. There is no data in the selected range.`;
  }

  const top = points.slice(0, 3).map((point) => `${point.x} (${point.y})`).join(", ");
  return `Here is your ${chart.chartType} chart for ${chart.title}. Top values: ${top}.`;
}

const starterPrompts = [
  "Show a bar chart of top pages in the last 14 days",
  "Make a bar chart of top referrers for the last 7 days",
  "Create a line chart of daily event volume for the last 30 days",
  "Plot a line chart of hourly events for the last 24 hours",
  "Show a pie chart of device types for this week",
  "Give me a pie chart of country distribution for today",
];

function AskAiChartPanel({
  chart,
  chartTheme,
  legendTextColor,
}: {
  chart: AiNivoChartOutput;
  chartTheme: ReturnType<typeof createChartTheme>;
  legendTextColor: string;
}) {
  const points = chart.points
    .map((point) => ({ x: String(point.x ?? "Unknown"), y: Number(point.y) || 0 }))
    .filter((point) => point.x.length > 0);

  return (
    <div className="w-full rounded-lg border border-(--theme-border-primary) bg-(--theme-bg-primary) p-3">
      <div className="mb-2 text-sm font-medium text-(--theme-text-primary)">{chart.title}</div>
      <div style={{ height: 260 }}>
        {points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-(--theme-text-secondary)">
            No chart data for this range.
          </div>
        ) : chart.chartType === "line" ? (
          <ResponsiveLine
            data={[
              {
                id: chart.metricType || chart.title,
                data: points.map((point) => ({ x: point.x, y: point.y })),
              },
            ]}
            margin={{ top: 20, right: 24, bottom: 44, left: 56 }}
            xScale={{ type: "point" }}
            yScale={{ type: "linear", min: 0, max: "auto", stacked: false, reverse: false }}
            pointSize={7}
            pointBorderWidth={2}
            enableArea
            areaOpacity={0.2}
            useMesh
            colors={["#f59e0b"]}
            theme={chartTheme}
          />
        ) : chart.chartType === "pie" ? (
          <ResponsivePie
            data={points.map((point) => ({ id: point.x, label: point.x, value: point.y }))}
            margin={{ top: 20, right: 24, bottom: 44, left: 24 }}
            innerRadius={0.5}
            padAngle={0.7}
            cornerRadius={3}
            activeOuterRadiusOffset={8}
            colors={["#f59e0b", "#f97316", "#fb923c", "#fdba74", "#fcd34d", "#fbbf24"]}
            theme={chartTheme}
            legends={[
              {
                anchor: "bottom",
                direction: "row",
                justify: false,
                translateY: 36,
                itemWidth: 90,
                itemHeight: 18,
                itemsSpacing: 4,
                symbolSize: 12,
                symbolShape: "circle",
                itemTextColor: legendTextColor,
              },
            ]}
          />
        ) : (
          <ResponsiveBar
            data={points.map((point) => ({ x: point.x, y: point.y }))}
            keys={["y"]}
            indexBy="x"
            margin={{ top: 20, right: 24, bottom: 56, left: 72 }}
            padding={0.3}
            colors={["#f59e0b"]}
            valueScale={{ type: "linear" }}
            indexScale={{ type: "band", round: true }}
            axisBottom={{
              tickRotation: -20,
              tickPadding: 14,
              format: (value) => truncateAxisLabel(value),
            }}
            theme={chartTheme}
          />
        )}
      </div>
    </div>
  );
}

export function AskAiWorkspace({ initialAiConfigured, initialAiModel }: AskAiWorkspaceProps) {
  const { current_site } = useContext(AuthContext) || { current_site: null };
  const { theme } = useTheme();
  const chartTheme = useMemo(() => createChartTheme(theme === "dark"), [theme]);
  const legendTextColor = theme === "dark" ? "#ffffff" : "#4b5563";
  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: {
          site_id: current_site?.id ?? null,
        },
      }),
    [current_site?.id],
  );

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const aiConfigured = initialAiConfigured;

  const {
    messages,
    status,
    error,
    sendMessage,
    setMessages,
    clearError,
  } = useChat({
    transport: chatTransport,
    experimental_throttle: 24,
  });

  const isBusy = status === "submitted" || status === "streaming";
  const canSend = aiConfigured && !isBusy;
  const [draft, setDraft] = useState("");
  const draftValue = typeof draft === "string" ? draft : "";
  const modelLabel = aiConfigured
    ? (initialAiModel || "Configured model")
    : "Model not configured";

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const frame = window.requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, status, error]);

  return (
    <section className="w-full min-h-[calc(100dvh-9rem)]">
      <div className="flex h-[calc(100dvh-11rem)] min-h-[560px] flex-col rounded-xl border border-(--theme-border-primary) bg-(--theme-card-bg) p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-(--theme-text-primary)">Ask AI</h2>
            <p className="mt-1 text-sm text-(--theme-text-secondary)">
              Quick conversational help for analytics questions and report ideas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex rounded-full border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2.5 py-1 text-xs text-(--theme-text-secondary)">
              {modelLabel}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setMessages([]);
                clearError();
              }}
              disabled={messages.length === 0 && !error}
            >
              Clear
            </Button>
          </div>
        </div>

        {!aiConfigured ? (
          <div className="mt-4 rounded-lg border border-red-500 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            AI is not configured on the server yet.
          </div>
        ) : null}

        <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-lg border border-(--theme-border-primary) bg-(--theme-bg-secondary) p-3">
          <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-1">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-(--theme-text-secondary)">
                  Ask a question or use a starter prompt below.
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.role === "user";
                const text = getMessageText(message.parts as Array<unknown>);
                const chart = getChartOutput(message.parts as Array<unknown>);

                if (text.trim().length === 0 && !chart) {
                  return null;
                }

                if (isUser) {
                  return (
                    <div
                      key={message.id}
                      className="ml-auto max-w-[92%] rounded-lg bg-(--theme-text-primary) px-3 py-2 text-sm whitespace-pre-wrap text-(--theme-bg-primary)"
                    >
                      {text}
                    </div>
                  );
                }

                return (
                  <div key={message.id} className="mr-auto w-full space-y-2">
                    {text.trim().length > 0 ? (
                      <div className="max-w-[92%] rounded-lg border border-(--theme-border-primary) bg-(--theme-bg-primary) px-3 py-2 text-sm whitespace-pre-wrap text-(--theme-text-primary)">
                        {text}
                      </div>
                    ) : chart ? (
                      <div className="max-w-[92%] rounded-lg border border-(--theme-border-primary) bg-(--theme-bg-primary) px-3 py-2 text-sm whitespace-pre-wrap text-(--theme-text-primary)">
                        {getChartFallbackSummary(chart)}
                      </div>
                    ) : null}
                    {chart ? (
                      <AskAiChartPanel
                        chart={chart}
                        chartTheme={chartTheme}
                        legendTextColor={legendTextColor}
                      />
                    ) : null}
                  </div>
                );
              })
            )}
            {error ? <p className="text-sm text-red-400">{error.message}</p> : null}
          </div>

          {messages.length === 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="rounded-full border border-(--theme-border-primary) bg-(--theme-bg-primary) px-3 py-1.5 text-xs text-(--theme-text-primary) hover:bg-(--theme-bg-tertiary)"
                  onClick={() => setDraft(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSend) {
                return;
              }
              const nextMessage = draftValue.trim();
              if (!nextMessage) return;
              clearError();
              void sendMessage({ text: nextMessage });
              setDraft("");
            }}
          >
            <input
              value={draftValue}
              onChange={(event) => {
                if (error) clearError();
                setDraft(event.target.value);
              }}
              placeholder={aiConfigured ? "Ask about your data..." : "AI not configured"}
              disabled={!aiConfigured || isBusy}
              className="flex-1 rounded-md border border-(--theme-input-border) bg-(--theme-input-bg) px-3 py-2 text-sm text-(--theme-text-primary) focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary)"
            />
            <Button type="submit" variant="primary" disabled={!canSend || draftValue.trim().length === 0}>
              {isBusy ? "..." : "Send"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
