"use client";

import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { AuthContext } from "@/app/providers/AuthProvider";
import { AlertBanner } from "@/app/components/ui/AlertBanner";
import { ReportWidgetChart } from "@/app/components/reports/custom/ReportWidgetChart";
import { buildSqlForWidget } from "@/app/components/reports/custom/buildWidgetSql";
import { reportPaletteOptions } from "@/app/components/reports/custom/chartPalettes";
import type {
  CustomReportConfig,
  CustomReportRecord,
  CustomReportWidgetConfig,
  ReportAggregation,
  ReportChartType,
  ReportColorPalette,
  SiteEventsSchemaColumn,
} from "@/app/components/reports/custom/types";

const GRID_COLUMNS = 12;
const GRID_ROWS = 8;
const DEFAULT_WIDGET_WIDTH = 4;
const DEFAULT_WIDGET_HEIGHT = 3;

const chartTypeOptions: Array<{ value: ReportChartType; label: string }> = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "pie", label: "Pie" },
  { value: "funnel", label: "Funnel" },
  { value: "sankey", label: "Sankey" },
];

const aggregationOptions: Array<{ value: ReportAggregation; label: string }> = [
  { value: "count", label: "Count" },
  { value: "unique_users", label: "Unique users" },
  { value: "sum", label: "Sum of y" },
  { value: "avg", label: "Average of y" },
];

type CustomReportBuilderPageProps = {
  reportUuid?: string;
  initialTemplate?: string | null;
};

type SchemaResponse = {
  tables?: Array<{ columns?: SiteEventsSchemaColumn[] }>;
  error?: string;
};

type ReportApiResponse = {
  report?: CustomReportRecord;
  error?: string;
};

const overlaps = (
  a: CustomReportWidgetConfig["layout"],
  b: CustomReportWidgetConfig["layout"],
) =>
  a.x < b.x + b.w &&
  a.x + a.w > b.x &&
  a.y < b.y + b.h &&
  a.y + a.h > b.y;

const makeWidgetId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `widget_${Math.random().toString(36).slice(2)}`;

const pickFirstColumn = (columns: string[], preferred: string[]) => {
  for (const value of preferred) {
    if (columns.includes(value)) return value;
  }
  return columns[0] || "event";
};

const createWidget = (
  chartType: ReportChartType,
  x: number,
  y: number,
  availableColumns: string[],
): CustomReportWidgetConfig => {
  const xField = pickFirstColumn(availableColumns, [
    "event",
    "client_page_url",
    "referer",
    "country",
    "city",
    "device_type",
    "created_at",
  ]);
  const yField = pickFirstColumn(availableColumns, [
    "screen_width",
    "screen_height",
    "id",
  ]);
  const sourceField = pickFirstColumn(availableColumns, ["referer", "country", "city", "event"]);
  const targetField = pickFirstColumn(availableColumns, ["event", "client_page_url", "device_type", "country"]);

  return {
    id: makeWidgetId(),
    title: `New ${chartType} chart`,
    chartType,
    xField,
    yField,
    aggregation: "count",
    sourceField,
    targetField,
    colorPalette: "primary",
    limit: 20,
    layout: {
      x,
      y,
      w: DEFAULT_WIDGET_WIDTH,
      h: DEFAULT_WIDGET_HEIGHT,
    },
  };
};

const createTemplateWidgets = (
  template: string | null | undefined,
  availableColumns: string[],
): CustomReportWidgetConfig[] => {
  if (template === "ecomm-tracker") {
    return [
      {
        ...createWidget("line", 0, 0, availableColumns),
        title: "Daily page views",
        xField: "created_at",
        colorPalette: "line",
      },
      {
        ...createWidget("bar", 4, 0, availableColumns),
        title: "Top product pages",
        xField: pickFirstColumn(availableColumns, ["client_page_url", "page_url", "event"]),
        colorPalette: "primary",
      },
      {
        ...createWidget("funnel", 8, 0, availableColumns),
        title: "Conversion funnel",
        xField: "event",
        colorPalette: "funnel",
      },
    ];
  }

  if (template === "marketing-leads") {
    return [
      {
        ...createWidget("bar", 0, 0, availableColumns),
        title: "Leads by source",
        xField: pickFirstColumn(availableColumns, ["referer", "country", "event"]),
        colorPalette: "mixed",
      },
      {
        ...createWidget("pie", 4, 0, availableColumns),
        title: "Leads by region",
        xField: pickFirstColumn(availableColumns, ["region", "country", "city"]),
        colorPalette: "secondary",
      },
      {
        ...createWidget("sankey", 8, 0, availableColumns),
        title: "Source to event flow",
        sourceField: pickFirstColumn(availableColumns, ["referer", "country", "city"]),
        targetField: pickFirstColumn(availableColumns, ["event", "client_page_url", "device_type"]),
        colorPalette: "primary",
      },
    ];
  }

  return [];
};

export function CustomReportBuilderPage({ reportUuid, initialTemplate }: CustomReportBuilderPageProps) {
  const isExistingReport = Boolean(reportUuid);
  const { current_site } = useContext(AuthContext) || {
    current_site: null,
  };

  const [reportName, setReportName] = useState("Untitled custom report");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSiteId, setReportSiteId] = useState<number | null>(current_site?.id ?? null);
  const [widgets, setWidgets] = useState<CustomReportWidgetConfig[]>([]);
  const [selectedChartType, setSelectedChartType] = useState<ReportChartType>("bar");
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasHydratedReportRef = useRef(false);
  const hasInitializedTemplateRef = useRef(false);

  useEffect(() => {
    if (!isExistingReport && current_site?.id) {
      setReportSiteId(current_site.id);
    }
  }, [isExistingReport, current_site?.id]);

  const schemaQuery = useQuery({
    queryKey: ["custom-report-schema", reportSiteId],
    enabled: Boolean(reportSiteId),
    queryFn: async () => {
      const response = await fetch(`/api/site-events/schema?site_id=${reportSiteId}`);
      const data = (await response.json().catch(() => null)) as SchemaResponse | null;
      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch site_events schema");
      }
      return data;
    },
  });

  const reportQuery = useQuery({
    queryKey: ["custom-report-config", reportUuid],
    enabled: isExistingReport,
    queryFn: async () => {
      const response = await fetch(`/api/reports/custom/${reportUuid}`);
      const data = (await response.json().catch(() => null)) as ReportApiResponse | null;
      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch custom report");
      }
      return data?.report ?? null;
    },
  });

  useEffect(() => {
    if (!reportQuery.data || hasHydratedReportRef.current) return;

    const report = reportQuery.data;
    setReportName(report.name || "Untitled custom report");
    setReportDescription(report.description || "");
    setReportSiteId(report.site_id);
    setWidgets(report.config?.widgets || []);
    setSelectedWidgetId(report.config?.widgets?.[0]?.id || null);
    hasHydratedReportRef.current = true;
  }, [reportQuery.data]);

  const availableColumns = useMemo(() => {
    const columns = schemaQuery.data?.tables?.[0]?.columns || [];
    return columns.map((column) => column.name);
  }, [schemaQuery.data]);

  useEffect(() => {
    if (isExistingReport) return;
    if (hasInitializedTemplateRef.current) return;
    if (availableColumns.length === 0) return;

    const templateWidgets = createTemplateWidgets(initialTemplate, availableColumns);
    if (templateWidgets.length > 0) {
      setWidgets(templateWidgets);
      setSelectedWidgetId(templateWidgets[0].id);
    }
    hasInitializedTemplateRef.current = true;
  }, [isExistingReport, initialTemplate, availableColumns]);

  const selectedWidget = widgets.find((widget) => widget.id === selectedWidgetId) ?? null;

  const canPlaceLayout = (
    nextLayout: CustomReportWidgetConfig["layout"],
    ignoreWidgetId?: string,
  ) => {
    if (nextLayout.x < 0 || nextLayout.y < 0) return false;
    if (nextLayout.w < 1 || nextLayout.h < 1) return false;
    if (nextLayout.x + nextLayout.w > GRID_COLUMNS) return false;
    if (nextLayout.y + nextLayout.h > GRID_ROWS) return false;

    return widgets.every((widget) => {
      if (ignoreWidgetId && widget.id === ignoreWidgetId) return true;
      return !overlaps(nextLayout, widget.layout);
    });
  };

  const addWidgetAtCell = (x: number, y: number) => {
    setErrorMessage(null);
    const nextWidget = createWidget(selectedChartType, x, y, availableColumns);
    if (!canPlaceLayout(nextWidget.layout)) {
      setErrorMessage("That grid area is occupied. Pick another position.");
      return;
    }

    setWidgets((prev) => [...prev, nextWidget]);
    setSelectedWidgetId(nextWidget.id);
  };

  const updateWidget = (widgetId: string, updater: (widget: CustomReportWidgetConfig) => CustomReportWidgetConfig) => {
    setWidgets((prev) =>
      prev.map((widget) => {
        if (widget.id !== widgetId) return widget;
        return updater(widget);
      }),
    );
  };

  const removeWidget = (widgetId: string) => {
    setWidgets((prev) => prev.filter((widget) => widget.id !== widgetId));
    if (selectedWidgetId === widgetId) {
      setSelectedWidgetId(null);
    }
  };

  const widgetDataQueries = useQueries({
    queries: widgets.map((widget) => ({
      queryKey: [
        "custom-report-widget-data",
        reportSiteId,
        widget.id,
        JSON.stringify(widget),
      ],
      enabled: Boolean(reportSiteId) && availableColumns.length > 0,
      queryFn: async () => {
        const query = buildSqlForWidget(widget, availableColumns);
        const response = await fetch("/api/site-events/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site_id: reportSiteId,
            query,
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { rows?: Array<Record<string, unknown>>; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load widget data");
        }

        return payload?.rows || [];
      },
    })),
  });

  const saveReport = async () => {
    if (!reportSiteId) {
      setErrorMessage("Select a site before saving a custom report.");
      return;
    }
    if (!reportName.trim()) {
      setErrorMessage("Report name is required.");
      return;
    }
    if (widgets.length === 0) {
      setErrorMessage("Add at least one chart widget before saving.");
      return;
    }

    const config: CustomReportConfig = {
      version: 1,
      widgets,
    };

    setErrorMessage(null);
    setIsSaving(true);
    try {
      const endpoint = isExistingReport
        ? `/api/reports/custom/${reportUuid}`
        : "/api/reports/custom";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: reportSiteId,
          name: reportName.trim(),
          description: reportDescription.trim() || null,
          config,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { uuid?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save report");
      }

      const nextUuid = payload?.uuid || reportUuid;
      if (!nextUuid) {
        throw new Error("Save succeeded but report id was missing");
      }

      setNotice("Report saved.");
      if (!isExistingReport) {
        window.location.assign(`/dashboard/reports/custom/${nextUuid}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save report");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isExistingReport && !current_site?.id) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-xl border border-(--theme-border-primary) bg-(--theme-card-bg) p-6">
          <h2 className="text-xl font-semibold text-(--theme-text-primary)">Select a site first</h2>
          <p className="mt-2 text-(--theme-text-secondary)">
            Pick a site from the dashboard selector, then open custom report builder.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(notice || errorMessage) && (
        <div className="fixed bottom-4 right-4 z-[70] w-[min(24rem,calc(100vw-2rem))]">
          <AlertBanner
            tone={errorMessage ? "error" : "info"}
            message={errorMessage || notice || ""}
            onDismiss={() => {
              setNotice(null);
              setErrorMessage(null);
            }}
          />
        </div>
      )}

      <section className="rounded-xl border border-(--theme-border-primary) bg-(--theme-card-bg) p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 w-full">
            <label className="block text-xs uppercase tracking-wide text-(--theme-text-secondary)">
              Report Name
            </label>
            <input
              value={reportName}
              onChange={(event) => setReportName(event.target.value)}
              className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-3 py-2 text-(--theme-text-primary)"
              placeholder="Untitled custom report"
            />
            <textarea
              value={reportDescription}
              onChange={(event) => setReportDescription(event.target.value)}
              className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-3 py-2 text-sm text-(--theme-text-primary)"
              rows={2}
              placeholder="Optional description"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              void saveReport();
            }}
            disabled={isSaving}
            className="rounded-md bg-(--theme-button-bg) px-4 py-2 text-sm font-semibold text-white hover:bg-(--theme-button-hover) disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save report"}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-4">
        <div className="rounded-xl border border-(--theme-border-primary) bg-(--theme-card-bg) p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-(--theme-text-primary)">Layout editor</h3>
            <div className="flex items-center gap-2">
              <label className="text-xs text-(--theme-text-secondary)">Chart type</label>
              <select
                value={selectedChartType}
                onChange={(event) => setSelectedChartType(event.target.value as ReportChartType)}
                className="rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1 text-sm text-(--theme-text-primary)"
              >
                {chartTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-(--theme-text-secondary)">
            Click empty cells to place a new chart widget.
          </p>

          <div className="grid grid-cols-12 auto-rows-[72px] gap-2">
            {Array.from({ length: GRID_COLUMNS * GRID_ROWS }).map((_, index) => {
              const x = index % GRID_COLUMNS;
              const y = Math.floor(index / GRID_COLUMNS);
              const occupied = widgets.some((widget) =>
                x >= widget.layout.x &&
                x < widget.layout.x + widget.layout.w &&
                y >= widget.layout.y &&
                y < widget.layout.y + widget.layout.h,
              );

              return (
                <button
                  key={`cell-${x}-${y}`}
                  type="button"
                  onClick={() => addWidgetAtCell(x, y)}
                  disabled={occupied}
                  className={`rounded-md border text-xs transition-colors ${occupied
                    ? "border-(--theme-border-primary) bg-(--theme-bg-secondary) text-transparent cursor-not-allowed"
                    : "border-dashed border-(--theme-border-primary) bg-(--theme-bg-secondary) text-(--theme-text-secondary) hover:bg-(--theme-bg-tertiary)"
                    }`}
                >
                  +
                </button>
              );
            })}

            {widgets.map((widget) => {
              const isSelected = widget.id === selectedWidgetId;
              return (
                <div
                  key={widget.id}
                  style={{
                    gridColumn: `${widget.layout.x + 1} / span ${widget.layout.w}`,
                    gridRow: `${widget.layout.y + 1} / span ${widget.layout.h}`,
                  }}
                  className={`z-20 rounded-md border p-2 text-xs ${isSelected
                    ? "border-(--theme-border-secondary) bg-(--theme-bg-tertiary)"
                    : "border-(--theme-border-primary) bg-(--theme-card-bg)"
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedWidgetId(widget.id)}
                    className="w-full text-left"
                  >
                    <p className="font-semibold text-(--theme-text-primary) truncate">{widget.title}</p>
                    <p className="text-(--theme-text-secondary)">{widget.chartType}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeWidget(widget.id)}
                    className="mt-2 text-[10px] text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="rounded-xl border border-(--theme-border-primary) bg-(--theme-card-bg) p-4 sm:p-6 space-y-3">
          <h3 className="text-lg font-semibold text-(--theme-text-primary)">Widget settings</h3>
          {!selectedWidget ? (
            <p className="text-sm text-(--theme-text-secondary)">Select a widget from the grid to edit it.</p>
          ) : (
            <>
              <label className="block text-xs text-(--theme-text-secondary)">Title</label>
              <input
                value={selectedWidget.title}
                onChange={(event) => updateWidget(selectedWidget.id, (widget) => ({ ...widget, title: event.target.value }))}
                className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
              />

              <label className="block text-xs text-(--theme-text-secondary)">Chart type</label>
              <select
                value={selectedWidget.chartType}
                onChange={(event) => updateWidget(selectedWidget.id, (widget) => ({ ...widget, chartType: event.target.value as ReportChartType }))}
                className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
              >
                {chartTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              {selectedWidget.chartType === "sankey" ? (
                <>
                  <label className="block text-xs text-(--theme-text-secondary)">Source field</label>
                  <select
                    value={selectedWidget.sourceField}
                    onChange={(event) => updateWidget(selectedWidget.id, (widget) => ({ ...widget, sourceField: event.target.value }))}
                    className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
                  >
                    {availableColumns.map((column) => (
                      <option key={`source-${column}`} value={column}>{column}</option>
                    ))}
                  </select>

                  <label className="block text-xs text-(--theme-text-secondary)">Target field</label>
                  <select
                    value={selectedWidget.targetField}
                    onChange={(event) => updateWidget(selectedWidget.id, (widget) => ({ ...widget, targetField: event.target.value }))}
                    className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
                  >
                    {availableColumns.map((column) => (
                      <option key={`target-${column}`} value={column}>{column}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="block text-xs text-(--theme-text-secondary)">X field</label>
                  <select
                    value={selectedWidget.xField}
                    onChange={(event) => updateWidget(selectedWidget.id, (widget) => ({ ...widget, xField: event.target.value }))}
                    className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
                  >
                    {availableColumns.map((column) => (
                      <option key={`x-${column}`} value={column}>{column}</option>
                    ))}
                  </select>
                </>
              )}

              <label className="block text-xs text-(--theme-text-secondary)">Y aggregation</label>
              <select
                value={selectedWidget.aggregation}
                onChange={(event) => updateWidget(selectedWidget.id, (widget) => ({ ...widget, aggregation: event.target.value as ReportAggregation }))}
                className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
              >
                {aggregationOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <label className="block text-xs text-(--theme-text-secondary)">Y field (for sum/avg)</label>
              <select
                value={selectedWidget.yField}
                onChange={(event) => updateWidget(selectedWidget.id, (widget) => ({ ...widget, yField: event.target.value }))}
                className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
                disabled={selectedWidget.aggregation === "count" || selectedWidget.aggregation === "unique_users"}
              >
                {availableColumns.map((column) => (
                  <option key={`y-${column}`} value={column}>{column}</option>
                ))}
              </select>

              <label className="block text-xs text-(--theme-text-secondary)">Palette</label>
              <select
                value={selectedWidget.colorPalette}
                onChange={(event) => updateWidget(selectedWidget.id, (widget) => ({ ...widget, colorPalette: event.target.value as ReportColorPalette }))}
                className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
              >
                {reportPaletteOptions.map((palette) => (
                  <option key={palette.value} value={palette.value}>{palette.label}</option>
                ))}
              </select>

              <label className="block text-xs text-(--theme-text-secondary)">Rows limit</label>
              <input
                type="number"
                min={1}
                max={500}
                value={selectedWidget.limit}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  updateWidget(selectedWidget.id, (widget) => ({
                    ...widget,
                    limit: Number.isFinite(nextValue) ? nextValue : widget.limit,
                  }));
                }}
                className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-(--theme-text-secondary)">Width</label>
                  <input
                    type="number"
                    min={1}
                    max={GRID_COLUMNS}
                    value={selectedWidget.layout.w}
                    onChange={(event) => {
                      const nextW = Number(event.target.value);
                      if (!Number.isFinite(nextW)) return;
                      const nextLayout = { ...selectedWidget.layout, w: nextW };
                      if (!canPlaceLayout(nextLayout, selectedWidget.id)) {
                        setErrorMessage("That width overlaps another widget.");
                        return;
                      }
                      updateWidget(selectedWidget.id, (widget) => ({ ...widget, layout: nextLayout }));
                    }}
                    className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
                  />
                </div>
                <div>
                  <label className="block text-xs text-(--theme-text-secondary)">Height</label>
                  <input
                    type="number"
                    min={1}
                    max={GRID_ROWS}
                    value={selectedWidget.layout.h}
                    onChange={(event) => {
                      const nextH = Number(event.target.value);
                      if (!Number.isFinite(nextH)) return;
                      const nextLayout = { ...selectedWidget.layout, h: nextH };
                      if (!canPlaceLayout(nextLayout, selectedWidget.id)) {
                        setErrorMessage("That height overlaps another widget.");
                        return;
                      }
                      updateWidget(selectedWidget.id, (widget) => ({ ...widget, layout: nextLayout }));
                    }}
                    className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
                  />
                </div>
              </div>
            </>
          )}
        </aside>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-(--theme-text-primary)">Live preview</h3>
        {widgets.length === 0 ? (
          <p className="text-sm text-(--theme-text-secondary)">Add widgets to preview this report.</p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {widgets.map((widget, index) => {
              const query = widgetDataQueries[index];
              return (
                <div key={`preview-${widget.id}`} className="rounded-xl border border-(--theme-border-primary) bg-(--theme-card-bg) p-4">
                  <p className="text-sm font-semibold text-(--theme-text-primary) mb-3">{widget.title}</p>
                  {schemaQuery.isLoading || query.isLoading ? (
                    <div className="h-[220px] flex items-center justify-center text-sm text-(--theme-text-secondary)">
                      Loading chart data...
                    </div>
                  ) : query.error ? (
                    <div className="h-[220px] flex items-center justify-center text-sm text-red-400">
                      {(query.error as Error).message}
                    </div>
                  ) : (
                    <ReportWidgetChart
                      widget={widget}
                      rows={(query.data as Array<Record<string, unknown>>) || []}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
