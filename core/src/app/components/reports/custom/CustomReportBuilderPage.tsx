"use client";

import {
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "@/app/providers/AuthProvider";
import { AlertBanner } from "@/app/components/ui/AlertBanner";
import { DashboardCard } from "@/app/components/DashboardCard";
import { HelpTooltip } from "@/app/components/charts/ChartComponents";
import { ReportWidgetChart } from "@/app/components/reports/custom/ReportWidgetChart";
import { buildSqlForWidget } from "@/app/components/reports/custom/buildWidgetSql";
import {
  reportColorPalettes,
  reportPaletteOptions,
} from "@/app/components/reports/custom/chartPalettes";
import { useDashboardRouteFilters } from "@/app/components/reports/DashboardRouteFiltersContext";
import type {
  CustomReportConfig,
  CustomReportRecord,
  CustomReportWidgetConfig,
  ReportAggregation,
  ReportChartType,
  ReportColorPalette,
  SiteEventsSchemaColumn,
} from "@/app/components/reports/custom/types";
import type { EventLabelSelect } from "@db/d1/schema";

type RowMode = "split" | "full";

type CanvasRow = {
  mode: RowMode;
  full: CustomReportWidgetConfig | null;
  left: CustomReportWidgetConfig | null;
  right: CustomReportWidgetConfig | null;
};

const ROW_HEIGHT = 4;
const HALF_SLOT_WIDTH = 6;
const FULL_SLOT_WIDTH = 12;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const normalizeHexColor = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!HEX_COLOR_PATTERN.test(withHash)) return null;
  return withHash.toUpperCase();
};

const getHalfSlotLayout = (rowIndex: number, slotIndex: 0 | 1): CustomReportWidgetConfig["layout"] => ({
  x: slotIndex === 0 ? 0 : HALF_SLOT_WIDTH,
  y: rowIndex * ROW_HEIGHT,
  w: HALF_SLOT_WIDTH,
  h: ROW_HEIGHT,
});

const getFullRowLayout = (rowIndex: number): CustomReportWidgetConfig["layout"] => ({
  x: 0,
  y: rowIndex * ROW_HEIGHT,
  w: FULL_SLOT_WIDTH,
  h: ROW_HEIGHT,
});

const getRowIndexFromLayout = (layout: CustomReportWidgetConfig["layout"]) =>
  Math.max(0, Math.floor(layout.y / ROW_HEIGHT));

const getSlotIndexFromLayout = (layout: CustomReportWidgetConfig["layout"]) =>
  layout.x >= HALF_SLOT_WIDTH ? 1 : 0;

const isFullRowLayout = (layout: CustomReportWidgetConfig["layout"]) => layout.w >= FULL_SLOT_WIDTH;

const buildCanvasRows = (widgetList: CustomReportWidgetConfig[]): CanvasRow[] => {
  const groupedRows = new Map<number, CustomReportWidgetConfig[]>();

  for (const widget of widgetList) {
    const rowIndex = getRowIndexFromLayout(widget.layout);
    const rowWidgets = groupedRows.get(rowIndex) ?? [];
    rowWidgets.push(widget);
    groupedRows.set(rowIndex, rowWidgets);
  }

  const rowIndexes = [...groupedRows.keys()].toSorted((a, b) => a - b);
  const rows: CanvasRow[] = [];
  const overflow: CustomReportWidgetConfig[] = [];

  for (const rowIndex of rowIndexes) {
    const rowWidgets = groupedRows.get(rowIndex) ?? [];
    const fullWidget = rowWidgets.find((widget) => isFullRowLayout(widget.layout));

    if (fullWidget) {
      rows.push({ mode: "full", full: fullWidget, left: null, right: null });
      for (const widget of rowWidgets) {
        if (widget.id !== fullWidget.id) overflow.push(widget);
      }
      continue;
    }

    const ordered = [...rowWidgets].toSorted((a, b) => getSlotIndexFromLayout(a.layout) - getSlotIndexFromLayout(b.layout));
    rows.push({
      mode: "split",
      full: null,
      left: ordered[0] ?? null,
      right: ordered[1] ?? null,
    });

    for (const widget of ordered.slice(2)) {
      overflow.push(widget);
    }
  }

  while (overflow.length > 0) {
    const first = overflow.shift()!;
    if (isFullRowLayout(first.layout)) {
      rows.push({ mode: "full", full: first, left: null, right: null });
      continue;
    }

    const second = overflow[0] && !isFullRowLayout(overflow[0].layout)
      ? overflow.shift() ?? null
      : null;

    rows.push({
      mode: "split",
      full: null,
      left: first,
      right: second,
    });
  }

  return rows;
};

const flattenCanvasRows = (rows: CanvasRow[]): CustomReportWidgetConfig[] => {
  const nextWidgets: CustomReportWidgetConfig[] = [];

  rows.forEach((row, rowIndex) => {
    if (row.mode === "full") {
      const widget = row.full ?? row.left ?? row.right;
      if (!widget) return;
      nextWidgets.push({
        ...widget,
        layout: getFullRowLayout(rowIndex),
      });
      return;
    }

    if (row.left) {
      nextWidgets.push({
        ...row.left,
        layout: getHalfSlotLayout(rowIndex, 0),
      });
    }
    if (row.right) {
      nextWidgets.push({
        ...row.right,
        layout: getHalfSlotLayout(rowIndex, 1),
      });
    }
  });

  return nextWidgets;
};

const normalizeWidgetsForRows = (widgetList: CustomReportWidgetConfig[]) =>
  flattenCanvasRows(buildCanvasRows(widgetList));

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) return [];

  const selectors = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ];

  return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(","))).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true",
  );
};

const chartTypeOptions: Array<{ value: ReportChartType; label: string }> = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "pie", label: "Pie" },
  { value: "funnel", label: "Funnel" },
  { value: "sankey", label: "Sankey" },
  { value: "map", label: "Map" },
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

type WidgetColorField = "customPrimaryColor" | "customSecondaryColor";

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
  availableColumns: string[],
): CustomReportWidgetConfig => {
  const xField = chartType === "map"
    ? pickFirstColumn(availableColumns, ["country", "region", "city", "event"])
    : pickFirstColumn(availableColumns, [
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
    customPrimaryColor: null,
    customSecondaryColor: null,
    limit: 20,
    layout: getHalfSlotLayout(0, 0),
  };
};

const createTemplateWidgets = (
  template: string | null | undefined,
  availableColumns: string[],
): CustomReportWidgetConfig[] => {
  if (template === "ecomm-tracker") {
    return [
      {
        ...createWidget("line", availableColumns),
        title: "Daily page views",
        xField: "created_at",
        colorPalette: "line",
      },
      {
        ...createWidget("bar", availableColumns),
        title: "Top product pages",
        xField: pickFirstColumn(availableColumns, ["client_page_url", "page_url", "event"]),
        colorPalette: "primary",
      },
    ];
  }

  if (template === "marketing-leads") {
    return [
      {
        ...createWidget("bar", availableColumns),
        title: "Leads by source",
        xField: pickFirstColumn(availableColumns, ["referer", "country", "event"]),
        colorPalette: "mixed",
      },
      {
        ...createWidget("pie", availableColumns),
        title: "Leads by region",
        xField: pickFirstColumn(availableColumns, ["region", "country", "city"]),
        colorPalette: "secondary",
      },
    ];
  }

  return [];
};

export function CustomReportBuilderPage({ reportUuid, initialTemplate }: CustomReportBuilderPageProps) {
  const queryClient = useQueryClient();
  const isExistingReport = Boolean(reportUuid);
  const { current_site, data: session, isPending: isSessionLoading } = useContext(AuthContext) || {
    current_site: null,
    data: null,
    isPending: true,
  };

  const fallbackSiteId = session?.userSites?.[0]?.site_id ?? null;
  const preferredSiteId = current_site?.id ?? fallbackSiteId;
  const routeFilterContext = useDashboardRouteFilters();
  const activeFilters = routeFilterContext?.filters;

  const [reportName, setReportName] = useState("Untitled custom report");
  const [reportSiteId, setReportSiteId] = useState<number | null>(preferredSiteId);
  const [widgets, setWidgets] = useState<CustomReportWidgetConfig[]>([]);
  const [selectedChartType, setSelectedChartType] = useState<ReportChartType>("bar");
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(!isExistingReport);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [extraRows, setExtraRows] = useState(0);
  const [rowModeOverrides, setRowModeOverrides] = useState<Record<number, RowMode>>({});
  const [editingWidgetTitleId, setEditingWidgetTitleId] = useState<string | null>(null);
  const [widgetTitleDraft, setWidgetTitleDraft] = useState("");
  const [primaryColorDraft, setPrimaryColorDraft] = useState("");
  const [secondaryColorDraft, setSecondaryColorDraft] = useState("");

  const hasHydratedReportRef = useRef(false);
  const hasInitializedTemplateRef = useRef(false);
  const deleteModalRef = useRef<HTMLDivElement | null>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const deleteCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const widgetTitleInputRef = useRef<HTMLInputElement | null>(null);
  const deleteModalTitleId = useId();
  const deleteModalDescriptionId = useId();

  useEffect(() => {
    if (!notice) return;

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  useEffect(() => {
    if (!isDeleteModalOpen) return;

    previousFocusedElementRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      deleteCancelButtonRef.current?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      previousFocusedElementRef.current?.focus();
    };
  }, [isDeleteModalOpen]);

  useEffect(() => {
    if (!isExistingReport && preferredSiteId) {
      setReportSiteId(preferredSiteId);
    }
  }, [isExistingReport, preferredSiteId]);

  useEffect(() => {
    setIsEditing(!isExistingReport);
  }, [isExistingReport, reportUuid]);

  useEffect(() => {
    hasHydratedReportRef.current = false;
  }, [reportUuid]);

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

  const labelsQuery = useQuery<EventLabelSelect[], Error>({
    queryKey: ["event-labels", reportSiteId],
    queryFn: async () => {
      if (!reportSiteId) return [];
      const response = await fetch(`/api/event-labels?site_id=${reportSiteId}`);
      if (!response.ok) throw new Error("Failed to fetch event labels");
      return response.json();
    },
    enabled: Boolean(reportSiteId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const eventLabelsMap = useMemo(() => {
    const map = new Map<string, string>();
    if (labelsQuery.data) {
      for (const label of labelsQuery.data) {
        map.set(label.event_name, label.label);
      }
    }
    return map;
  }, [labelsQuery.data]);

  useEffect(() => {
    if (!reportQuery.data || hasHydratedReportRef.current) return;

    const report = reportQuery.data;
    setReportName(report.name || "Untitled custom report");
    setReportSiteId(report.site_id);
    const normalizedWidgets = normalizeWidgetsForRows(report.config?.widgets || []);
    setWidgets(normalizedWidgets);
    setSelectedWidgetId(normalizedWidgets[0]?.id || null);
    setExtraRows(0);
    setRowModeOverrides({});
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

    const templateWidgets = normalizeWidgetsForRows(
      createTemplateWidgets(initialTemplate, availableColumns),
    );
    if (templateWidgets.length > 0) {
      setWidgets(templateWidgets);
      setSelectedWidgetId(templateWidgets[0].id);
    }
    setExtraRows(0);
    setRowModeOverrides({});
    hasInitializedTemplateRef.current = true;
  }, [isExistingReport, initialTemplate, availableColumns]);

  const selectedWidget = widgets.find((widget) => widget.id === selectedWidgetId) ?? null;

  useEffect(() => {
    if (!editingWidgetTitleId) return;
    if (widgets.some((widget) => widget.id === editingWidgetTitleId)) return;

    setEditingWidgetTitleId(null);
    setWidgetTitleDraft("");
  }, [editingWidgetTitleId, widgets]);

  useEffect(() => {
    if (!editingWidgetTitleId) return;
    widgetTitleInputRef.current?.focus();
    widgetTitleInputRef.current?.select();
  }, [editingWidgetTitleId]);

  const startWidgetTitleEdit = (widget: CustomReportWidgetConfig) => {
    setSelectedWidgetId(widget.id);
    setEditingWidgetTitleId(widget.id);
    setWidgetTitleDraft(widget.title);
  };

  const cancelWidgetTitleEdit = () => {
    setEditingWidgetTitleId(null);
    setWidgetTitleDraft("");
  };

  const commitWidgetTitleEdit = (widgetId: string) => {
    updateWidget(widgetId, (widget) => ({
      ...widget,
      title: widgetTitleDraft,
    }));
    setEditingWidgetTitleId(null);
    setWidgetTitleDraft("");
  };

  const renderWidgetTitle = (widget: CustomReportWidgetConfig) => {
    if (!isEditing) return widget.title;

    const isTitleEditing = editingWidgetTitleId === widget.id;
    if (isTitleEditing) {
      return (
        <input
          ref={widgetTitleInputRef}
          value={widgetTitleDraft}
          onChange={(event) => setWidgetTitleDraft(event.target.value)}
          onBlur={() => commitWidgetTitleEdit(widget.id)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();

            if (event.key === "Enter") {
              event.preventDefault();
              commitWidgetTitleEdit(widget.id);
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              cancelWidgetTitleEdit();
            }
          }}
          className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1 text-sm font-semibold text-(--theme-text-primary)"
          aria-label="Chart title"
        />
      );
    }

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          startWidgetTitleEdit(widget);
        }}
        className="-mx-1 rounded px-1 text-left text-lg sm:text-xl font-semibold text-(--theme-text-primary) hover:bg-(--theme-bg-secondary)"
        aria-label={`Edit title for ${widget.title}`}
      >
        {widget.title || "Untitled chart"}
      </button>
    );
  };

  const canvasRows = useMemo(() => buildCanvasRows(widgets), [widgets]);

  const totalRows = useMemo(
    () => Math.max(1, canvasRows.length) + extraRows,
    [canvasRows.length, extraRows],
  );

  const rowsForRender = useMemo(
    () =>
      Array.from({ length: totalRows }, (_, rowIndex) => {
        const existingRow = canvasRows[rowIndex];
        const mode = existingRow?.mode ?? rowModeOverrides[rowIndex] ?? "full";
        return {
          rowIndex,
          mode,
          full: existingRow?.full ?? null,
          left: existingRow?.left ?? null,
          right: existingRow?.right ?? null,
        };
      }),
    [canvasRows, rowModeOverrides, totalRows],
  );

  const selectedWidgetRowIndex = selectedWidget ? getRowIndexFromLayout(selectedWidget.layout) : null;
  const selectedRow = selectedWidgetRowIndex !== null ? rowsForRender[selectedWidgetRowIndex] ?? null : null;
  const selectedWidgetPlacement = useMemo(() => {
    if (!selectedWidgetId) return null;

    for (const row of rowsForRender) {
      if (row.full?.id === selectedWidgetId) {
        return `Row ${row.rowIndex + 1} - Full width`;
      }

      if (row.left?.id === selectedWidgetId) {
        return `Row ${row.rowIndex + 1} - Slot 1`;
      }

      if (row.right?.id === selectedWidgetId) {
        return `Row ${row.rowIndex + 1} - Slot 2`;
      }
    }

    return null;
  }, [rowsForRender, selectedWidgetId]);
  const yFieldUsedByAggregation = selectedWidget
    ? selectedWidget.aggregation === "sum" || selectedWidget.aggregation === "avg"
    : false;
  const selectedPalette = selectedWidget
    ? reportColorPalettes[selectedWidget.colorPalette]
    : reportColorPalettes.primary;
  const primaryFallbackColor = selectedPalette[0] ?? "#3B82F6";
  const secondaryFallbackColor = selectedPalette[1] ?? primaryFallbackColor;

  useEffect(() => {
    if (!selectedWidget) {
      setPrimaryColorDraft("");
      setSecondaryColorDraft("");
      return;
    }

    setPrimaryColorDraft(selectedWidget.customPrimaryColor ?? "");
    setSecondaryColorDraft(selectedWidget.customSecondaryColor ?? "");
  }, [
    selectedWidget?.id,
    selectedWidget?.customPrimaryColor,
    selectedWidget?.customSecondaryColor,
  ]);

  const applyCustomColor = (widgetId: string, field: WidgetColorField, rawValue: string) => {
    const normalized = normalizeHexColor(rawValue);
    updateWidget(widgetId, (widget) => ({
      ...widget,
      [field]: normalized,
    }));
  };

  const addWidgetAtSlot = (rowIndex: number, slotIndex: 0 | 1) => {
    setErrorMessage(null);

    const row = rowsForRender[rowIndex];
    if (!row) return;

    if (row.mode === "full") {
      if (row.full) {
        setSelectedWidgetId(row.full.id);
        return;
      }

      const fullWidget: CustomReportWidgetConfig = {
        ...createWidget(selectedChartType, availableColumns),
        layout: getFullRowLayout(rowIndex),
      };

      const nextRows = [...canvasRows];
      while (nextRows.length <= rowIndex) {
        nextRows.push({ mode: "split", full: null, left: null, right: null });
      }
      nextRows[rowIndex] = { mode: "full", full: fullWidget, left: null, right: null };

      setWidgets(normalizeWidgetsForRows(flattenCanvasRows(nextRows)));
      setSelectedWidgetId(fullWidget.id);
      setExtraRows((prev) => (rowIndex >= canvasRows.length ? Math.max(0, prev - 1) : prev));
      return;
    }

    const existing = slotIndex === 0 ? row.left : row.right;
    if (existing) {
      setSelectedWidgetId(existing.id);
      return;
    }

    const nextWidget: CustomReportWidgetConfig = {
      ...createWidget(selectedChartType, availableColumns),
      layout: getHalfSlotLayout(rowIndex, slotIndex),
    };

    const nextRows = [...canvasRows];
    while (nextRows.length <= rowIndex) {
      nextRows.push({ mode: "split", full: null, left: null, right: null });
    }

    const targetRow = nextRows[rowIndex] ?? { mode: "split", full: null, left: null, right: null };
    nextRows[rowIndex] = {
      mode: "split",
      full: null,
      left: slotIndex === 0 ? nextWidget : targetRow.left,
      right: slotIndex === 1 ? nextWidget : targetRow.right,
    };

    setWidgets(normalizeWidgetsForRows(flattenCanvasRows(nextRows)));
    setSelectedWidgetId(nextWidget.id);
    setExtraRows((prev) => (rowIndex >= canvasRows.length ? Math.max(0, prev - 1) : prev));
  };

  const updateRowMode = (rowIndex: number, nextMode: RowMode) => {
    const row = rowsForRender[rowIndex];
    if (!row) return;

    const hasWidgets = Boolean(row.full || row.left || row.right);
    if (!hasWidgets) {
      setRowModeOverrides((prev) => ({ ...prev, [rowIndex]: nextMode }));
      return;
    }

    const nextRows = [...canvasRows];
    while (nextRows.length <= rowIndex) {
      nextRows.push({ mode: "split", full: null, left: null, right: null });
    }

    const currentRow = nextRows[rowIndex] ?? { mode: "split", full: null, left: null, right: null };

    if (nextMode === "full") {
      const candidates = [currentRow.full, currentRow.left, currentRow.right].filter(
        (widget): widget is CustomReportWidgetConfig => Boolean(widget),
      );
      if (candidates.length === 0) {
        setRowModeOverrides((prev) => ({ ...prev, [rowIndex]: "full" }));
        return;
      }

      const primary =
        candidates.find((widget) => widget.id === selectedWidgetId) ?? candidates[0];
      const overflow = candidates.filter((widget) => widget.id !== primary.id);

      nextRows[rowIndex] = { mode: "full", full: primary, left: null, right: null };
      if (overflow.length > 0) {
        nextRows.splice(rowIndex + 1, 0, {
          mode: "split",
          full: null,
          left: overflow[0] ?? null,
          right: overflow[1] ?? null,
        });
      }
      setSelectedWidgetId(primary.id);
    } else {
      if (currentRow.mode === "full") {
        let pulledWidget: CustomReportWidgetConfig | null = null;
        const nextRow = nextRows[rowIndex + 1];
        if (nextRow?.mode === "split") {
          pulledWidget = nextRow.left ?? nextRow.right ?? null;

          if (pulledWidget) {
            const pulledWidgetId = pulledWidget.id;
            const remaining = [nextRow.left, nextRow.right].filter(
              (widget): widget is CustomReportWidgetConfig =>
                widget != null && widget.id !== pulledWidgetId,
            );

            if (remaining.length === 0) {
              nextRows.splice(rowIndex + 1, 1);
            } else {
              nextRows[rowIndex + 1] = {
                mode: "split",
                full: null,
                left: remaining[0] ?? null,
                right: remaining[1] ?? null,
              };
            }
          }
        }

        nextRows[rowIndex] = {
          mode: "split",
          full: null,
          left: currentRow.full,
          right: pulledWidget,
        };
        if (currentRow.full) {
          setSelectedWidgetId(currentRow.full.id);
        }
      } else {
        nextRows[rowIndex] = {
          mode: "split",
          full: null,
          left: currentRow.left,
          right: currentRow.right,
        };
      }
    }

    setRowModeOverrides((prev) => {
      const next = { ...prev };
      delete next[rowIndex];
      return next;
    });

    setWidgets(normalizeWidgetsForRows(flattenCanvasRows(nextRows)));
  };

  const updateWidget = (widgetId: string, updater: (widget: CustomReportWidgetConfig) => CustomReportWidgetConfig) => {
    setWidgets((prev) =>
      normalizeWidgetsForRows(
        prev.map((widget) => {
          if (widget.id !== widgetId) return widget;
          return updater(widget);
        }),
      ),
    );
  };

  const removeWidget = (widgetId: string) => {
    setWidgets((prev) => normalizeWidgetsForRows(prev.filter((widget) => widget.id !== widgetId)));
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
        activeFilters?.dateRange.start,
        activeFilters?.dateRange.end,
        activeFilters?.deviceType,
        activeFilters?.country,
        activeFilters?.city,
        activeFilters?.region,
        activeFilters?.source,
        activeFilters?.pageUrl,
        activeFilters?.eventName,
      ],
      enabled: Boolean(reportSiteId) && availableColumns.length > 0,
      queryFn: async () => {
        const query = buildSqlForWidget(widget, availableColumns, {
          dateRange: activeFilters?.dateRange,
          deviceType: activeFilters?.deviceType,
          country: activeFilters?.country,
          city: activeFilters?.city,
          region: activeFilters?.region,
          source: activeFilters?.source,
          pageUrl: activeFilters?.pageUrl,
          eventName: activeFilters?.eventName,
        });
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

  const widgetQueryById = useMemo(() => {
    const map = new Map<string, (typeof widgetDataQueries)[number]>();
    widgets.forEach((widget, index) => {
      map.set(widget.id, widgetDataQueries[index]);
    });
    return map;
  }, [widgets, widgetDataQueries]);

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
          description: null,
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

      const normalizedName = reportName.trim();
      const normalizedSiteId = reportSiteId;
      const normalizedTeamId = session?.team?.id ?? reportQuery.data?.team_id ?? 0;
      const nextReportRecord: CustomReportRecord = {
        uuid: nextUuid,
        site_id: normalizedSiteId,
        team_id: normalizedTeamId,
        name: normalizedName,
        description: null,
        config,
      };

      queryClient.setQueryData(
        ["dashboard-toolbar-active-custom-report", nextUuid],
        { report: nextReportRecord },
      );

      queryClient.setQueryData<{ reports?: CustomReportRecord[] }>(
        ["dashboard-toolbar-custom-reports", normalizedSiteId],
        (current) => {
          const reports = current?.reports ?? [];
          const reportIndex = reports.findIndex((report) => report.uuid === nextUuid);
          if (reportIndex >= 0) {
            const nextReports = [...reports];
            nextReports[reportIndex] = {
              ...nextReports[reportIndex],
              ...nextReportRecord,
            };
            return { reports: nextReports };
          }

          return { reports: [nextReportRecord, ...reports] };
        },
      );

      void queryClient.invalidateQueries({
        queryKey: ["dashboard-toolbar-custom-reports", normalizedSiteId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["dashboard-toolbar-active-custom-report", nextUuid],
      });

      setNotice("Report saved.");
      if (!isExistingReport) {
        window.location.assign(`/dashboard/reports/custom/${nextUuid}`);
      } else {
        setIsEditing(false);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save report");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteReport = async () => {
    if (!isExistingReport || !reportUuid) return;

    setErrorMessage(null);
    setNotice(null);
    setIsDeleteModalOpen(false);
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/reports/custom/${reportUuid}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete report");
      }

      window.location.assign("/dashboard/reports/create-report");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete report");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isExistingReport && !reportSiteId && !isSessionLoading) {
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
            tone={errorMessage ? "error" : "success"}
            message={errorMessage || notice || ""}
            onDismiss={() => {
              setNotice(null);
              setErrorMessage(null);
            }}
          />
        </div>
      )}

      {isDeleteModalOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsDeleteModalOpen(false);
            }
          }}
        >
          <div
            ref={deleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={deleteModalTitleId}
            aria-describedby={deleteModalDescriptionId}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setIsDeleteModalOpen(false);
                return;
              }

              if (event.key !== "Tab") return;

              const focusable = getFocusableElements(deleteModalRef.current);
              if (focusable.length === 0) return;

              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              const active = document.activeElement as HTMLElement | null;

              if (event.shiftKey) {
                if (!active || active === first) {
                  event.preventDefault();
                  last.focus();
                }
                return;
              }

              if (!active || active === last) {
                event.preventDefault();
                first.focus();
              }
            }}
            className="w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-(--theme-border-primary) bg-(--theme-card-bg) p-6 shadow-2xl"
          >
            <h3 id={deleteModalTitleId} className="text-lg font-semibold text-(--theme-text-primary)">
              Delete report?
            </h3>
            <p id={deleteModalDescriptionId} className="mt-2 text-sm text-(--theme-text-secondary)">
              Delete "{reportName}" permanently. This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                ref={deleteCancelButtonRef}
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded-md border border-(--theme-border-primary) px-3 py-1.5 text-sm font-medium text-(--theme-text-primary) hover:bg-(--theme-bg-secondary)"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void deleteReport();
                }}
                disabled={isDeleting}
                className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0 w-full">
          {isEditing ? (
            <input
              value={reportName}
              onChange={(event) => setReportName(event.target.value)}
              className="w-full min-w-[220px] sm:min-w-[360px] max-w-2xl rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-3 py-1.5 text-sm text-(--theme-text-primary)"
              placeholder="Untitled custom report"
              aria-label="Report name"
            />
          ) : (
            <h2 className="text-2xl font-bold text-(--theme-text-primary) truncate">{reportName}</h2>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isExistingReport && !isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-md border border-(--theme-border-primary) px-2.5 py-1 text-xs font-semibold text-(--theme-text-secondary) hover:bg-(--theme-bg-secondary)"
            >
              Edit
            </button>
          ) : null}

          {isEditing ? (
            <>
              {isExistingReport ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving || isDeleting}
                  className="rounded-md border border-(--theme-border-primary) px-2.5 py-1 text-xs font-semibold text-(--theme-text-secondary) hover:bg-(--theme-bg-secondary)"
                >
                  Cancel
                </button>
              ) : null}
              {isExistingReport ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(true);
                  }}
                  disabled={isSaving || isDeleting}
                  className="rounded-md border border-red-500/60 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                >
                  Delete
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  void saveReport();
                }}
                disabled={isSaving || isDeleting}
                className="rounded-md border border-(--theme-button-bg) px-2.5 py-1 text-xs font-semibold text-(--theme-text-primary) hover:bg-(--theme-bg-secondary) disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </>
          ) : null}
        </div>
      </header>

      <section className={isEditing ? "grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,4fr)_minmax(300px,1fr)]" : "space-y-4"}>
        <DashboardCard
          title={isEditing ? "Layout editor" : undefined}
          titleAs="h3"
          subtitle={isEditing ? "Build as many rows as you need. Each row can be split (two charts) or full-width (one chart)." : undefined}
          actions={isEditing ? (
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
          ) : undefined}
          className={isEditing ? "space-y-4" : "!border-0 !bg-transparent !p-0 space-y-4"}
        >
          <div className="space-y-4">
            {rowsForRender.map((row) => {
              const hasWidgets = Boolean(row.full || row.left || row.right);
              if (!isEditing && !hasWidgets) {
                return null;
              }

              const rowHeightClass = row.mode === "full" ? "h-[420px]" : "h-[340px]";

              return (
                <div key={`row-${row.rowIndex}`} className="space-y-2">
                  {isEditing ? (
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-(--theme-text-secondary)">
                        Row {row.rowIndex + 1}
                      </p>
                      <select
                        value={row.mode}
                        onChange={(event) => updateRowMode(row.rowIndex, event.target.value as RowMode)}
                        className="rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1 text-xs text-(--theme-text-primary)"
                      >
                        <option value="split">Two charts</option>
                        <option value="full">Full-width chart</option>
                      </select>
                    </div>
                  ) : null}

                  {row.mode === "full" ? (
                    row.full ? (
                      (() => {
                        const fullWidget = row.full;
                        const query = widgetQueryById.get(fullWidget.id);
                        const rowsData =
                          (query?.data as Array<Record<string, unknown>> | undefined) || [];
                        const isSelected = isEditing && fullWidget.id === selectedWidgetId;
                        const selectionClass = isEditing
                          ? (isSelected
                            ? "border-amber-500 ring-2 ring-amber-500 shadow-[0_0_0_1px_rgba(245,158,11,0.45)] dark:border-[var(--theme-border-secondary)] dark:ring-[var(--theme-border-secondary)] dark:shadow-none"
                            : "hover:border-amber-400 dark:hover:border-[var(--theme-border-secondary)]")
                          : "";

                        return (
                          <div
                            role={isEditing ? "button" : undefined}
                            tabIndex={isEditing ? 0 : undefined}
                            aria-pressed={isEditing ? isSelected : undefined}
                            onClick={() => {
                              if (!isEditing) return;
                              setSelectedWidgetId(fullWidget.id);
                            }}
                            onKeyDown={(event) => {
                              if (!isEditing) return;
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              setSelectedWidgetId(fullWidget.id);
                            }}
                            className={isEditing ? "rounded-lg focus:outline-none" : undefined}
                          >
                            <DashboardCard
                              title={renderWidgetTitle(fullWidget)}
                              titleAs="h3"
                              subtitle={isEditing ? `${fullWidget.chartType} - Full row` : undefined}
                              actions={isEditing ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeWidget(fullWidget.id);
                                  }}
                                  className="text-[10px] text-red-400 hover:text-red-300"
                                >
                                  Remove
                                </button>
                              ) : undefined}
                              className={`${rowHeightClass} flex flex-col transition-colors ${isSelected ? "bg-amber-500/15 dark:bg-(--theme-bg-tertiary)" : ""} ${selectionClass}`}
                            >
                              <div className="mt-1 flex-1 min-h-0">
                                {schemaQuery.isLoading || query?.isLoading || !query ? (
                                  <div className="h-full flex items-center justify-center text-sm text-(--theme-text-secondary)">
                                    Loading chart data...
                                  </div>
                                ) : query.error ? (
                                  <div className="h-full flex items-center justify-center text-sm text-red-400">
                                    {(query.error as Error).message}
                                  </div>
                                ) : (
                                  <div className="h-full flex flex-col">
                                    <ReportWidgetChart widget={fullWidget} rows={rowsData} labelsMap={eventLabelsMap} />
                                    {rowsData.length === 0 ? (
                                      <p className="mt-2 text-xs text-(--theme-text-secondary)">
                                        No data for this date range.
                                      </p>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            </DashboardCard>
                          </div>
                        );
                      })()
                    ) : (
                      isEditing ? (
                        <button
                          type="button"
                          onClick={() => addWidgetAtSlot(row.rowIndex, 0)}
                          className={`${rowHeightClass} w-full rounded-lg border border-dashed border-(--theme-border-primary) bg-(--theme-bg-secondary) text-(--theme-text-secondary) hover:bg-(--theme-bg-tertiary) transition-colors`}
                        >
                          <span className="text-sm font-medium">+ Add full-width chart</span>
                        </button>
                      ) : null
                    )
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {([0, 1] as const).map((slotIndex) => {
                        const slotWidget = slotIndex === 0 ? row.left : row.right;
                        if (!slotWidget) {
                          if (!isEditing) {
                            return null;
                          }

                          return (
                            <button
                              key={`row-${row.rowIndex}-slot-${slotIndex}`}
                              type="button"
                              onClick={() => addWidgetAtSlot(row.rowIndex, slotIndex)}
                              className={`${rowHeightClass} rounded-lg border border-dashed border-(--theme-border-primary) bg-(--theme-bg-secondary) text-(--theme-text-secondary) hover:bg-(--theme-bg-tertiary) transition-colors`}
                            >
                              <span className="text-sm font-medium">+ Add chart to slot {slotIndex + 1}</span>
                            </button>
                          );
                        }

                        const query = widgetQueryById.get(slotWidget.id);
                        const rowsData =
                          (query?.data as Array<Record<string, unknown>> | undefined) || [];
                        const isSelected = isEditing && slotWidget.id === selectedWidgetId;
                        const selectionClass = isEditing
                          ? (isSelected
                            ? "border-amber-500 ring-2 ring-amber-500 shadow-[0_0_0_1px_rgba(245,158,11,0.45)] dark:border-[var(--theme-border-secondary)] dark:ring-[var(--theme-border-secondary)] dark:shadow-none"
                            : "hover:border-amber-400 dark:hover:border-[var(--theme-border-secondary)]")
                          : "";

                        return (
                          <div
                            key={slotWidget.id}
                            role={isEditing ? "button" : undefined}
                            tabIndex={isEditing ? 0 : undefined}
                            aria-pressed={isEditing ? isSelected : undefined}
                            onClick={() => {
                              if (!isEditing) return;
                              setSelectedWidgetId(slotWidget.id);
                            }}
                            onKeyDown={(event) => {
                              if (!isEditing) return;
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              setSelectedWidgetId(slotWidget.id);
                            }}
                            className={isEditing ? "rounded-lg focus:outline-none" : undefined}
                          >
                            <DashboardCard
                              title={renderWidgetTitle(slotWidget)}
                              titleAs="h3"
                              subtitle={isEditing ? `${slotWidget.chartType} - Slot ${slotIndex + 1}` : undefined}
                              actions={isEditing ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeWidget(slotWidget.id);
                                  }}
                                  className="text-[10px] text-red-400 hover:text-red-300"
                                >
                                  Remove
                                </button>
                              ) : undefined}
                              className={`${rowHeightClass} flex flex-col transition-colors ${isSelected ? "bg-amber-500/15 dark:bg-(--theme-bg-tertiary)" : ""} ${selectionClass}`}
                            >
                              <div className="mt-1 flex-1 min-h-0">
                                {schemaQuery.isLoading || query?.isLoading || !query ? (
                                  <div className="h-full flex items-center justify-center text-sm text-(--theme-text-secondary)">
                                    Loading chart data...
                                  </div>
                                ) : query.error ? (
                                  <div className="h-full flex items-center justify-center text-sm text-red-400">
                                    {(query.error as Error).message}
                                  </div>
                                ) : (
                                  <div className="h-full flex flex-col">
                                    <ReportWidgetChart widget={slotWidget} rows={rowsData} labelsMap={eventLabelsMap} />
                                    {rowsData.length === 0 ? (
                                      <p className="mt-2 text-xs text-(--theme-text-secondary)">
                                        No data for this date range.
                                      </p>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            </DashboardCard>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {isEditing ? (
              <button
                type="button"
                onClick={() => {
                  const nextRowIndex = canvasRows.length + extraRows;
                  setRowModeOverrides((prev) => ({
                    ...prev,
                    [nextRowIndex]: "full",
                  }));
                  setExtraRows((prev) => prev + 1);
                }}
                className="rounded-md border border-dashed border-(--theme-border-primary) px-3 py-2 text-xs text-(--theme-text-secondary) hover:bg-(--theme-bg-secondary)"
              >
                + Add row
              </button>
            ) : null}
          </div>
        </DashboardCard>

        {isEditing ? (
          <DashboardCard
            title="Widget settings"
            titleAs="h3"
            subtitle={selectedWidget
              ? `${selectedWidget.title} ${selectedWidgetPlacement ? `(${selectedWidgetPlacement})` : ""}`
              : undefined}
            className="space-y-3 xl:sticky xl:top-4"
          >
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
                onChange={(event) => updateWidget(selectedWidget.id, (widget) => ({
                  ...widget,
                  chartType: event.target.value as ReportChartType,
                }))}
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

              <label className="block text-xs text-(--theme-text-secondary)">Y field</label>
              <select
                value={selectedWidget.yField}
                onChange={(event) => updateWidget(selectedWidget.id, (widget) => ({ ...widget, yField: event.target.value }))}
                className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
              >
                {availableColumns.map((column) => (
                  <option key={`y-${column}`} value={column}>{column}</option>
                ))}
              </select>
              {!yFieldUsedByAggregation ? (
                <p className="text-[11px] text-(--theme-text-secondary)">
                  Y field is used when Y aggregation is Sum of y or Average of y.
                </p>
              ) : null}

              <label className="block text-xs text-(--theme-text-secondary)">Color theme</label>
              <select
                value={selectedWidget.colorPalette}
                onChange={(event) => updateWidget(selectedWidget.id, (widget) => ({ ...widget, colorPalette: event.target.value as ReportColorPalette }))}
                className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
              >
                {reportPaletteOptions.map((palette) => (
                  <option key={palette.value} value={palette.value}>{palette.label}</option>
                ))}
              </select>

              <label className="block text-xs text-(--theme-text-secondary)">Custom colors (optional)</label>
              <div className="space-y-2">
                <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-2">
                  <input
                    type="color"
                    value={normalizeHexColor(selectedWidget.customPrimaryColor ?? "") ?? primaryFallbackColor}
                    onChange={(event) => {
                      const next = event.target.value.toUpperCase();
                      setPrimaryColorDraft(next);
                      applyCustomColor(selectedWidget.id, "customPrimaryColor", next);
                    }}
                    className="h-9 w-10 rounded border border-(--theme-border-primary) bg-(--theme-bg-secondary) p-1"
                    aria-label="Primary chart color picker"
                  />
                  <input
                    type="text"
                    value={primaryColorDraft}
                    onChange={(event) => setPrimaryColorDraft(event.target.value)}
                    onBlur={() => {
                      const normalized = normalizeHexColor(primaryColorDraft);
                      if (primaryColorDraft.trim().length > 0 && !normalized) {
                        setPrimaryColorDraft(selectedWidget.customPrimaryColor ?? "");
                        return;
                      }

                      applyCustomColor(selectedWidget.id, "customPrimaryColor", primaryColorDraft);
                    }}
                    placeholder="#FF6B35"
                    className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
                    aria-label="Primary chart color hex value"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPrimaryColorDraft("");
                      applyCustomColor(selectedWidget.id, "customPrimaryColor", "");
                    }}
                    className="rounded-md border border-(--theme-border-primary) px-2 py-1 text-xs text-(--theme-text-secondary) hover:bg-(--theme-bg-secondary)"
                  >
                    Reset
                  </button>
                </div>

                <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-2">
                  <input
                    type="color"
                    value={normalizeHexColor(selectedWidget.customSecondaryColor ?? "") ?? secondaryFallbackColor}
                    onChange={(event) => {
                      const next = event.target.value.toUpperCase();
                      setSecondaryColorDraft(next);
                      applyCustomColor(selectedWidget.id, "customSecondaryColor", next);
                    }}
                    className="h-9 w-10 rounded border border-(--theme-border-primary) bg-(--theme-bg-secondary) p-1"
                    aria-label="Secondary chart color picker"
                  />
                  <input
                    type="text"
                    value={secondaryColorDraft}
                    onChange={(event) => setSecondaryColorDraft(event.target.value)}
                    onBlur={() => {
                      const normalized = normalizeHexColor(secondaryColorDraft);
                      if (secondaryColorDraft.trim().length > 0 && !normalized) {
                        setSecondaryColorDraft(selectedWidget.customSecondaryColor ?? "");
                        return;
                      }

                      applyCustomColor(selectedWidget.id, "customSecondaryColor", secondaryColorDraft);
                    }}
                    placeholder="#4ECDC4"
                    className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
                    aria-label="Secondary chart color hex value"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSecondaryColorDraft("");
                      applyCustomColor(selectedWidget.id, "customSecondaryColor", "");
                    }}
                    className="rounded-md border border-(--theme-border-primary) px-2 py-1 text-xs text-(--theme-text-secondary) hover:bg-(--theme-bg-secondary)"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="block text-xs text-(--theme-text-secondary)">Rows limit</label>
                <HelpTooltip text={`Chart row limit ${selectedWidget.limit}`} />
              </div>
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

              {selectedWidgetRowIndex !== null && selectedRow ? (
                <>
                  <label className="block text-xs text-(--theme-text-secondary)">Row layout</label>
                  <select
                    value={selectedRow.mode}
                    onChange={(event) => updateRowMode(selectedWidgetRowIndex, event.target.value as RowMode)}
                    className="w-full rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) px-2 py-1.5 text-sm text-(--theme-text-primary)"
                  >
                    <option value="split">Two charts</option>
                    <option value="full">Full-width chart</option>
                  </select>
                </>
              ) : null}

              <p className="text-xs text-(--theme-text-secondary)">
                Layout stays on a row grid: each row can be split or full-width, and you can add more rows as needed.
              </p>
              </>
            )}
          </DashboardCard>
        ) : null}
      </section>

    </div>
  );
}
