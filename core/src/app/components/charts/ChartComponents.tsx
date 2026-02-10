"use client";

import { DashboardCard } from "@components/DashboardCard";
import { useTheme } from "@/app/providers/ThemeProvider";

import getUnicodeFlag from "country-flag-icons/unicode";
import { createChartTheme, chartColors } from "@/app/utils/chartThemes";
import { useMediaQuery } from "@/app/utils/media";
import {
  ScorecardProps,
  type ChartComponentProps,
  type NivoBarChartData,
  type NivoLineChartData,
  type NivoPieChartData,
  type TableComponentProps,
} from "@db/tranformReports";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { ResponsivePie } from "@nivo/pie";
import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useKeybinds } from "@/app/utils/keybinds";

type DateParts = { year: number; month: number; day: number };

export type DashboardNoticeType = "success" | "error" | "info";

export type DashboardNotice = {
  type: DashboardNoticeType;
  message: string;
};

// Filter interfaces
export interface DateRange {
  start: string;
  end: string;
  preset?: string;
}
export interface DashboardFilters {
  dateRange: DateRange;
  deviceType?: string;
  country?: string;
  city?: string;
  region?: string;
  source?: string;
  pageUrl?: string;
  eventName?: string;
  siteId?: string;
}
export type CurrentVisitorsResponse = {
  currentVisitors: number;
  windowSeconds: number;
  timestamp: string;
  siteId: number | null;
  error?: string;
};

export const isValidTimeZone = (value: unknown): value is string => {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
};

export const getBrowserTimeZone = (): string => {
  const guessed = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(guessed) ? guessed : "UTC";
};

export const formatDateParts = ({ year, month, day }: DateParts): string => {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
};

export const getDatePartsInTimeZone = (date: Date, timeZone: string): DateParts => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return {
    year: Number.isFinite(year) ? year : date.getUTCFullYear(),
    month: Number.isFinite(month) ? month : date.getUTCMonth() + 1,
    day: Number.isFinite(day) ? day : date.getUTCDate(),
  };
};

export const getDateStringInTimeZone = (date: Date, timeZone: string): string => {
  return formatDateParts(getDatePartsInTimeZone(date, timeZone));
};

export const shiftDateString = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map((value) => Number(value));
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return formatDateParts({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
};


export const getCountryFlagIcon = (country: string | null | undefined) => {
  const code = typeof country === "string" ? country.trim().toUpperCase() : "";

  if (!/^[A-Z]{2}$/.test(code)) {
    return null;
  }

  try {
    const flag = getUnicodeFlag(code);
    return (
      <span
        role="img"
        aria-label={code}
        className="text-base leading-none"
      >
        {flag}
      </span>
    );
  } catch {
    return null;
  }
};

export const CardTabs: React.FC<{
  tabs: string[];
  activeTab: string;
  onTabClick: (tab: string) => void;
  ariaLabel?: string;
  children?: React.ReactNode;
}> = ({ tabs, activeTab, onTabClick, ariaLabel = "Dashboard card tabs", children }) => {
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const getTabId = (tab: string) => `${baseId}-tab-${tab}`;
  const getPanelId = (tab: string) => `${baseId}-panel-${tab}`;

  const focusAndSelect = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    onTabClick(tab);
    tabRefs.current[index]?.focus();
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAndSelect((index + 1) % tabs.length);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAndSelect((index - 1 + tabs.length) % tabs.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusAndSelect(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusAndSelect(tabs.length - 1);
    }
  };

  return (
    <>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex border-b border-(--theme-border-primary) mb-4"
      >
        {tabs.map((tab: string, index) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              id={getTabId(tab)}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={getPanelId(tab)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabClick(tab)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`py-2 px-4 font-semibold focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary) rounded-t ${isActive
                ? "text-(--theme-text-primary) border-b-2 border-(--theme-border-primary)"
                : "text-(--theme-text-secondary) hover:text-(--theme-text-primary)"
                }`}
            >
              {tab}
            </button>
          );
        })}
      </div>
      {children && (
        <div
          role="tabpanel"
          id={getPanelId(activeTab)}
          aria-labelledby={getTabId(activeTab)}
        >
          {children}
        </div>
      )}
    </>
  );
};

export const TableComponent: React.FC<TableComponentProps> = ({
  tableId,
  tableData,
  title,
}) => {
  const displayTitle = title || tableData?.title || "Table";
  const isGeoTable = tableId === "geoDataTable";
  const isEmpty = !tableData || !tableData.headers || !tableData.rows || tableData.rows.length === 0;

  return (
    <DashboardCard id={tableId} title={displayTitle} className="mb-6" empty={isEmpty}>
      <div className="relative w-full">
        <div className="overflow-x-auto scrollbar-none">
          <table className="min-w-160 w-full divide-y divide-(--theme-border-primary)">
            <thead className="bg-(--theme-bg-secondary)">
              <tr>
                {(tableData?.headers || []).map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-(--theme-text-secondary) uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-(--theme-card-bg) divide-y divide-(--theme-border-primary)">
              {(tableData?.rows || []).map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-(--theme-bg-secondary) transition-colors"
                >
                  {(row || []).map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-3 sm:px-6 py-4 text-sm text-(--theme-text-primary)"
                    >
                      {isGeoTable && cellIndex === 0 && typeof cell === "string" ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-4 w-6 items-center justify-center">
                            {getCountryFlagIcon(cell) ?? (
                              <span className="h-4 w-4 rounded-full bg-blue-500" />
                            )}
                          </span>
                          <span>{cell}</span>
                        </div>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-linear-to-l from-(--theme-card-bg) to-transparent sm:hidden" />
      </div>
    </DashboardCard>
  );
};

export const ChartSkeleton = ({ height = "350px" }: { height?: string | number }) => (
  <div
    style={{ height: typeof height === "number" ? `${height}px` : height }}
    className="w-full rounded-md bg-(--theme-bg-secondary) animate-pulse"
  />
);
export const ChartComponent: React.FC<ChartComponentProps> = (props) => {
  const { chartId, chartData, title, height = "350px" } = props;
  const isSmallScreen = useMediaQuery("(max-width: 640px)");
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const [error] = useState<string | null>(null);

  const chartTheme = createChartTheme(theme === "dark");


  const renderChart = () => {
    if (!chartData || !props.type) return null; // chartType is set in useEffect

    if (
      props.type === "bar" &&
      "keys" in chartData &&
      "indexBy" in chartData
    ) {
      // Type guard for bar chart data
      const barData = chartData as NivoBarChartData;
      return (
        <ResponsiveBar
          data={barData?.data || []}
          keys={barData?.keys || []}
          indexBy={barData?.indexBy || "date"}
          margin={
            isSmallScreen
              ? { top: 40, right: 20, bottom: 60, left: 44 }
              : { top: 50, right: 130, bottom: 50, left: 60 }
          }
          padding={0.3}
          valueScale={{ type: "linear" }}
          indexScale={{ type: "band", round: true }}
          colors={chartColors.primary}
          borderColor="#1D4ED8"
          borderWidth={2}
          enableLabel={false}
          axisTop={null}
          axisRight={null}
          axisBottom={
            barData.axisBottom || {
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: "index",
              legendPosition: "middle",
              legendOffset: 32,
            }
          }
          axisLeft={
            barData.axisLeft || {
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: "value",
              legendPosition: "middle",
              legendOffset: -40,
            }
          }
          labelSkipWidth={12}
          labelSkipHeight={12}
          labelTextColor={{ from: "color", modifiers: [["darker", 1.6]] }}
          legends={
            isSmallScreen
              ? []
              : barData.legends || [
                {
                  dataFrom: "keys",
                  anchor: "bottom-right",
                  direction: "column",
                  justify: false,
                  translateX: 120,
                  translateY: 0,
                  itemsSpacing: 2,
                  itemWidth: 100,
                  itemHeight: 20,
                  itemDirection: "left-to-right",
                  itemOpacity: 0.85,
                  symbolSize: 20,
                  effects: [{ on: "hover", style: { itemOpacity: 1 } }],
                },
              ]
          }
          animate={true}
          theme={chartTheme}
        />
      );
    } else if (props.type === "pie") {
      const pieData = chartData as NivoPieChartData;
      return (
        <ResponsivePie
          data={pieData?.data || []}
          margin={
            isSmallScreen
              ? { top: 10, right: 10, bottom: 10, left: 10 }
              : { top: 40, right: 80, bottom: 80, left: 80 }
          }
          onClick={(datum) => props.onItemClick?.(String(datum.id))}
          innerRadius={0.5}
          padAngle={0.7}
          cornerRadius={3}
          activeOuterRadiusOffset={8}
          borderWidth={1}
          borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
          enableArcLinkLabels={!isSmallScreen}
          arcLinkLabelsSkipAngle={10}
          arcLinkLabelsThickness={2}
          arcLinkLabelsColor={{ from: "color" }}
          arcLinkLabelsTextColor={theme === "dark" ? "#FFFFFF" : "#111827"}
          arcLabelsSkipAngle={isSmallScreen ? 30 : 10}
          arcLabelsTextColor={theme === "dark" ? "#FFFFFF" : "#111827"}
          colors={chartColors.mixed}
          legends={
            isSmallScreen
              ? []
              : pieData.legends || [
                {
                  anchor: "bottom",
                  direction: "row",
                  justify: false,
                  translateX: 0,
                  translateY: 56,
                  itemsSpacing: 0,
                  itemWidth: 100,
                  itemHeight: 18,
                  itemDirection: "left-to-right",
                  itemOpacity: 1,
                  symbolSize: 18,
                  symbolShape: "circle",
                  itemTextColor: theme === "dark" ? "#ffffff" : "#374151",
                  effects: [{ on: "hover", style: { itemOpacity: 1 } }],
                },
              ]
          }
          theme={chartTheme}
        />
      );
    } else if (props.type === "line") {
      const lineData = chartData as NivoLineChartData;
      const rawSeries = lineData?.data || [];
      const isSinglePoint = rawSeries.length > 0 && rawSeries.every((s) => s.data.length === 1);
      const singlePointDate = isSinglePoint ? String(rawSeries[0].data[0].x) : null;

      const series = rawSeries.map((s) => {
        if (s.data.length !== 1) return s;
        const pt = s.data[0];
        const xVal = String(pt.x);
        if (/^\d{4}-\d{2}-\d{2}$/.test(xVal)) {
          const d = new Date(xVal);
          const prev = new Date(d);
          prev.setDate(prev.getDate() - 1);
          const next = new Date(d);
          next.setDate(next.getDate() + 1);
          const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
          return { ...s, data: [{ x: fmt(prev), y: 0 }, pt, { x: fmt(next), y: 0 }] };
        }
        return { ...s, data: [{ x: "", y: 0 }, pt, { x: " ", y: 0 }] };
      });

      return (
        <>
          <ResponsiveLine
            data={series}
            margin={{ top: 50, right: 20, bottom: 50, left: 50 }}
            xScale={{ type: "point" }}
            yScale={{
              type: "linear",
              min: 0,
              max: "auto",
              stacked: false,
              reverse: false,
            }}
            colors={chartColors.line}
            curve="monotoneX"
            enableArea={true}
            areaOpacity={1}
            defs={[
              {
                id: "accentGradient",
                type: "linearGradient",
                colors: [
                  { offset: 0, color: "#3B82F6", opacity: 0.4 },
                  { offset: 100, color: "#3B82F6", opacity: 0 },
                ],
              },
            ]}
            fill={[{ match: "*", id: "accentGradient" }]}
            axisTop={null}
            axisRight={null}
            axisLeft={{
              tickSize: 0,
              tickPadding: 8,
              tickValues: 5,
            }}
            axisBottom={{
              tickSize: 0,
              tickPadding: 10,
              tickRotation: 0,
              legend: "",
              legendOffset: 36,
              legendPosition: "middle",
              renderTick: (tick) => {
                if (isSinglePoint && String(tick.value) !== singlePointDate) {
                  return <g />;
                }
                const label = String(tick.value);
                const display = /^\d{4}-\d{2}-\d{2}$/.test(label)
                  ? `${label.split("-")[1]}/${label.split("-")[2]}`
                  : label;
                return (
                  <g transform={`translate(${tick.x},${tick.y})`}>
                    <text
                      x={0}
                      y={15}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ fill: "#9CA3AF", fontSize: "11px", fontWeight: 600 }}
                    >
                      {display}
                    </text>
                  </g>
                );
              },
            }}
            enableGridX={false}
            enableGridY={true}
            gridYValues={5}
            theme={chartTheme}
            pointSize={isSinglePoint ? 10 : 8}
            pointColor={{ theme: "background" }}
            pointBorderWidth={2}
            pointBorderColor={{ from: "serieColor" }}
            pointLabelYOffset={-12}
            useMesh={true}
            tooltip={({ point }) => (
              <div style={{
                background: theme === "dark" ? "#484743" : "#fff",
                color: theme === "dark" ? "#fff" : "#111827",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                border: `1px solid ${theme === "dark" ? "#575353" : "#E5E7EB"}`,
              }}>
                {point.data.yFormatted} page views
              </div>
            )}
          />
        </>
      );
    }
    return null;
  };

  const showSkeleton = props.isLoading && !chartData;
  const showOverlay = props.isLoading && !!chartData;
  const showChart = !!chartData && !error;

  return (
    <DashboardCard title={title} className="mb-6" isUpdating={showOverlay} updatingLabel="Updating chart...">
      <div
        ref={chartContainerRef}
        id={chartId}
        style={{
          height: typeof height === "number" ? `${height}px` : height,
          minHeight: typeof height === "number" ? `${height}px` : height,
          position: "relative",
          cursor: props.onItemClick ? "pointer" : undefined,
        }}
      >
        {showSkeleton && <ChartSkeleton height={height} />}

        {showChart && renderChart()}

        {!props.isLoading && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-danger bg-opacity-20 p-4 text-center rounded-lg">
            <p className="text-danger font-semibold">Error!</p>
            <p className="text-danger text-sm opacity-80">
              {error}
            </p>
          </div>
        )}
      </div>
      {isSmallScreen && props.type === "pie" && showChart && (() => {
        const pieItems = (chartData as NivoPieChartData)?.data || [];
        if (pieItems.length === 0) return null;
        return (
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-2">
            {pieItems.map((item, i) => (
              <div key={item.id} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: chartColors.mixed[i % chartColors.mixed.length] }}
                />
                <span className="text-xs text-(--theme-text-secondary)">
                  {item.id}
                </span>
              </div>
            ))}
          </div>
        );
      })()}
    </DashboardCard>
  );
};

export const SkeletonBlock = ({ className }: { className: string }) => (
  <div
    className={`animate-pulse rounded bg-(--theme-bg-secondary) ${className}`}
  />
);

export const ScorecardSkeleton = () => (
  <div className="bg-(--theme-card-bg) border border-(--theme-card-border) rounded-lg p-4 text-left">
    <SkeletonBlock className="h-3 w-20 mb-3" />
    <SkeletonBlock className="h-7 w-24 mb-3" />
    <div className="flex items-center">
      <SkeletonBlock className="h-3 w-16" />
    </div>
  </div>
);



export const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      className="opacity-25"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);
export const HelpTooltip = ({ text }: { text: string }) => {
  const tooltipId = useId();
  return (
    <span className="relative inline-flex items-center group">
      <button
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-(--theme-border-primary) text-[10px] text-(--theme-text-secondary) hover:text-(--theme-text-primary) hover:border-(--theme-border-primary) transition-colors focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary)"
        aria-describedby={tooltipId}
      >
        <span aria-hidden="true">i</span>
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-md bg-gray-900 px-3 py-2 text-xs text-gray-50 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
};
export function CurrentVisitors({ siteId }: { siteId: number }) {
  const { data, isFetching } = useQuery({
    queryKey: ["currentVisitors", siteId],
    queryFn: async () => {
      const response = await fetch(
        `/api/dashboard/current-visitors?site_id=${siteId}&windowSeconds=${60 * 5}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      );

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const messageFromApi =
          typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof (payload as { error: unknown }).error === "string"
            ? (payload as { error: string }).error
            : null;

        const requestIdFromApi =
          typeof payload === "object" &&
            payload !== null &&
            "requestId" in payload &&
            typeof (payload as { requestId?: unknown }).requestId === "string"
            ? (payload as { requestId: string }).requestId
            : null;

        const baseMessage =
          messageFromApi ||
          `Failed to fetch current visitors (HTTP ${response.status})`;

        throw new Error(
          requestIdFromApi ? `${baseMessage} (requestId: ${requestIdFromApi})` : baseMessage,
        );
      }

      return payload as CurrentVisitorsResponse;
    },
    enabled: !!siteId,
    refetchInterval: 10_000,
    staleTime: 0,
  });

  const currentVisitors = data?.currentVisitors;

  return (
    <div className="flex items-center space-x-2">
      <svg
        aria-hidden="true"
        focusable="false"
        className="h-3 w-3 fill-current text-(--color-secondary)"
        viewBox="0 0 8 8"
      >
        <circle cx="4" cy="4" r="3" />
      </svg>
      <span className="text-sm text-(--theme-text-secondary)">
        {typeof currentVisitors === "number" ? currentVisitors : "—"} Current Visitors
      </span>
      <HelpTooltip text="Approximate distinct visitors in the last 5 minutes. Updates every 10 seconds." />
      {isFetching && (
        <SpinnerIcon className="w-3 h-3 text-(--theme-text-secondary) animate-spin" />
      )}
    </div>
  );
}

export const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) return [];

  const selectors = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ];

  return Array.from(
    container.querySelectorAll<HTMLElement>(selectors.join(",")),
  ).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true",
  );
};

export const FilterModal: React.FC<{
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  isOpen: boolean;
  onClose: () => void;
  onNotify: (notice: DashboardNotice) => void;
  deviceTypeOptions?: string[];
  countryOptions?: string[];
  cityOptions?: string[];
  regionOptions?: string[];
  sourceOptions?: string[];
  pageUrlOptions?: string[];
  eventNameOptions?: string[];
}> = ({ filters, onFiltersChange, isOpen, onClose, deviceTypeOptions = [], countryOptions = [], cityOptions = [], regionOptions = [], sourceOptions = [], pageUrlOptions = [], eventNameOptions = [] }) => {
  const titleId = useId();
  const deviceTypeId = useId();
  const countryId = useId();
  const cityId = useId();
  const regionId = useId();
  const sourceId = useId();
  const pageUrlId = useId();
  const eventNameId = useId();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  const updateFilter = (patch: Partial<DashboardFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      dateRange: filters.dateRange,
      deviceType: undefined,
      country: undefined,
      city: undefined,
      region: undefined,
      source: undefined,
      pageUrl: undefined,
      eventName: undefined,
      siteId: filters.siteId,
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    // Wait a tick so the modal is in the DOM.
    const frame = requestAnimationFrame(() => {
      const focusable = getFocusableElements(modalRef.current);
      (focusable[0] ?? modalRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = getFocusableElements(modalRef.current);
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
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-stretch justify-end z-50"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="bg-(--theme-bg-secondary) h-full w-full max-w-88 sm:max-w-104 md:max-w-120 p-6 shadow-xl border-l border-(--theme-border-primary) overflow-y-auto sm:rounded-l-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id={titleId}
            className="text-xl font-semibold text-(--theme-text-primary)"
          >
            Filters
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-(--theme-text-secondary) hover:text-(--theme-text-primary) transition-colors focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary) rounded"
            aria-label="Close filters"
          >
            <svg
              aria-hidden="true"
              focusable="false"
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Device Type Filter */}
          <div>
            <label
              htmlFor={deviceTypeId}
              className="block text-sm font-medium text-(--theme-text-primary) mb-2"
            >
              Device Type
            </label>
            <select
              id={deviceTypeId}
              value={filters.deviceType || ""}
              onChange={(e) =>
                updateFilter({ deviceType: e.target.value || undefined })
              }
              className="w-full px-3 py-2 bg-(--theme-input-bg) border border-(--theme-input-border) rounded text-sm text-(--theme-text-primary) focus:border-(--theme-border-primary) focus:outline-none"
            >
              <option value="">All Devices</option>
              {deviceTypeOptions.map((dt) => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
          </div>

          {/* Country Filter */}
          <div>
            <label
              htmlFor={countryId}
              className="block text-sm font-medium text-(--theme-text-primary) mb-2"
            >
              Country
            </label>
            <select
              id={countryId}
              value={filters.country || ""}
              onChange={(e) =>
                updateFilter({ country: e.target.value || undefined })
              }
              className="w-full px-3 py-2 bg-(--theme-input-bg) border border-(--theme-input-border) rounded text-sm text-(--theme-text-primary) focus:border-(--theme-border-primary) focus:outline-none"
            >
              <option value="">All Countries</option>
              {countryOptions.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>

          {/* Region Filter */}
          <div>
            <label
              htmlFor={regionId}
              className="block text-sm font-medium text-(--theme-text-primary) mb-2"
            >
              Region
            </label>
            <select
              id={regionId}
              value={filters.region || ""}
              onChange={(e) =>
                updateFilter({ region: e.target.value || undefined })
              }
              className="w-full px-3 py-2 bg-(--theme-input-bg) border border-(--theme-input-border) rounded text-sm text-(--theme-text-primary) focus:border-(--theme-border-primary) focus:outline-none"
            >
              <option value="">All Regions</option>
              {regionOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* City Filter */}
          <div>
            <label
              htmlFor={cityId}
              className="block text-sm font-medium text-(--theme-text-primary) mb-2"
            >
              City
            </label>
            <select
              id={cityId}
              value={filters.city || ""}
              onChange={(e) =>
                updateFilter({ city: e.target.value || undefined })
              }
              className="w-full px-3 py-2 bg-(--theme-input-bg) border border-(--theme-input-border) rounded text-sm text-(--theme-text-primary) focus:border-(--theme-border-primary) focus:outline-none"
            >
              <option value="">All Cities</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Traffic Source Filter */}
          <div>
            <label
              htmlFor={sourceId}
              className="block text-sm font-medium text-(--theme-text-primary) mb-2"
            >
              Traffic Source
            </label>
            <select
              id={sourceId}
              value={filters.source || ""}
              onChange={(e) =>
                updateFilter({ source: e.target.value || undefined })
              }
              className="w-full px-3 py-2 bg-(--theme-input-bg) border border-(--theme-input-border) rounded text-sm text-(--theme-text-primary) focus:border-(--theme-border-primary) focus:outline-none"
            >
              <option value="">All Sources</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>

          {/* Page URL Filter */}
          <div>
            <label
              htmlFor={pageUrlId}
              className="block text-sm font-medium text-(--theme-text-primary) mb-2"
            >
              Page
            </label>
            <select
              id={pageUrlId}
              value={filters.pageUrl || ""}
              onChange={(e) =>
                updateFilter({ pageUrl: e.target.value || undefined })
              }
              className="w-full px-3 py-2 bg-(--theme-input-bg) border border-(--theme-input-border) rounded text-sm text-(--theme-text-primary) focus:border-(--theme-border-primary) focus:outline-none"
            >
              <option value="">All Pages</option>
              {pageUrlOptions.map((page) => (
                <option key={page} value={page}>{page}</option>
              ))}
            </select>
          </div>

          {/* Event Filter */}
          <div>
            <label
              htmlFor={eventNameId}
              className="block text-sm font-medium text-(--theme-text-primary) mb-2"
            >
              Event
            </label>
            <select
              id={eventNameId}
              value={filters.eventName || ""}
              onChange={(e) =>
                updateFilter({ eventName: e.target.value || undefined })
              }
              className="w-full px-3 py-2 bg-(--theme-input-bg) border border-(--theme-input-border) rounded text-sm text-(--theme-text-primary) focus:border-(--theme-border-primary) focus:outline-none"
            >
              <option value="">All Events</option>
              {eventNameOptions.map((ev) => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </select>
          </div>

          <p className="text-xs text-(--theme-text-secondary)">
            Tip: Filters apply across all dashboard cards.
          </p>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleClearFilters}
            className="w-full px-4 py-2 bg-(--theme-input-bg) text-(--theme-text-secondary) border border-(--theme-input-border) rounded hover:bg-(--theme-bg-secondary) transition-colors focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary)"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}


export const DatePicker: React.FC<{
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  isOpen: boolean;
  onToggle: () => void;
  timezone: string;
}> = ({ dateRange, onDateRangeChange, isOpen, onToggle, timezone }) => {
  const titleId = useId();
  const startDateId = useId();
  const endDateId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState<DateRange>(dateRange);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(dateRange);
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      const d = draftRef.current;
      if (!d.preset && (d.start !== dateRange.start || d.end !== dateRange.end)) {
        onDateRangeChange(d);
      }
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const frame = requestAnimationFrame(() => {
      const focusable = getFocusableElements(containerRef.current);
      (focusable[0] ?? containerRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const wrapper = containerRef.current?.parentElement;
      if (wrapper && !wrapper.contains(target)) {
        onToggle();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  const computePresetRange = (key: string): { start: string; end: string } => {
    const now = new Date();
    const today = getDateStringInTimeZone(now, timezone);
    const daysAgo = (n: number) => shiftDateString(today, -n);
    const todayParts = getDatePartsInTimeZone(now, timezone);
    const currentYear = todayParts.year;
    const currentMonth = todayParts.month;

    switch (key) {
      case "Last 30 min": {
        const s = new Date(now.getTime() - 30 * 60 * 1000);
        return { start: s.toISOString(), end: now.toISOString() };
      }
      case "Last hour": {
        const s = new Date(now.getTime() - 60 * 60 * 1000);
        return { start: s.toISOString(), end: now.toISOString() };
      }
      case "Today":
        return { start: today, end: today };
      case "Yesterday": {
        const y = daysAgo(1);
        return { start: y, end: y };
      }
      case "Last 7 days":
        return { start: daysAgo(7), end: today };
      case "Last 30 days":
        return { start: daysAgo(30), end: today };
      case "Last 6 months":
        return { start: daysAgo(180), end: today };
      case "Last 12 months":
        return { start: daysAgo(365), end: today };
      case "Month to Date": {
        return {
          start: formatDateParts({ year: currentYear, month: currentMonth, day: 1 }),
          end: today,
        };
      }
      case "Last Month": {
        const firstOfCurrentMonthUtc = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
        const firstOfLastMonthUtc = new Date(firstOfCurrentMonthUtc);
        firstOfLastMonthUtc.setUTCMonth(firstOfLastMonthUtc.getUTCMonth() - 1);
        const lastOfLastMonthUtc = new Date(firstOfCurrentMonthUtc);
        lastOfLastMonthUtc.setUTCDate(0);
        return {
          start: formatDateParts({
            year: firstOfLastMonthUtc.getUTCFullYear(),
            month: firstOfLastMonthUtc.getUTCMonth() + 1,
            day: firstOfLastMonthUtc.getUTCDate(),
          }),
          end: formatDateParts({
            year: lastOfLastMonthUtc.getUTCFullYear(),
            month: lastOfLastMonthUtc.getUTCMonth() + 1,
            day: lastOfLastMonthUtc.getUTCDate(),
          }),
        };
      }
      case "Year to Date": {
        return {
          start: formatDateParts({ year: currentYear, month: 1, day: 1 }),
          end: today,
        };
      }
      case "Last year": {
        const previousYear = currentYear - 1;
        return {
          start: formatDateParts({ year: previousYear, month: 1, day: 1 }),
          end: formatDateParts({ year: previousYear, month: 12, day: 31 }),
        };
      }
      default:
        return { start: daysAgo(7), end: today };
    }
  };

  type PresetItem = { label: string; shortcut: string } | "separator";

  const presetGroups: PresetItem[] = [
    { label: "Last 30 min", shortcut: "R" },
    { label: "Last hour", shortcut: "H" },
    { label: "Today", shortcut: "D" },
    { label: "Yesterday", shortcut: "E" },
    "separator",
    { label: "Last 7 days", shortcut: "W" },
    { label: "Last 30 days", shortcut: "T" },
    { label: "Last 6 months", shortcut: "6" },
    { label: "Last 12 months", shortcut: "0" },
    "separator",
    { label: "Month to Date", shortcut: "M" },
    { label: "Last Month", shortcut: "P" },
    "separator",
    { label: "Year to Date", shortcut: "Y" },
    { label: "Last year", shortcut: "U" },
  ];

  const handlePresetClick = (label: string) => {
    const { start, end } = computePresetRange(label);
    const newRange: DateRange = { start, end, preset: label };
    setDraft(newRange);
    onDateRangeChange(newRange);
    onToggle();
  };

  const handleCustomDateChange = (field: "start" | "end", value: string) => {
    setDraft((prev) => ({
      ...prev,
      [field]: value,
      preset: undefined,
    }));
  };

  useKeybinds({
    binds: presetGroups
      .filter((item): item is { label: string; shortcut: string } => item !== "separator")
      .map((item) => ({
        key: item.shortcut,
        action: () => handlePresetClick(item.label),
      })),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onToggle();
        }

        if (event.key === "Tab") {
          const focusable = getFocusableElements(containerRef.current);
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
        }
      }}
      className="absolute top-full right-0 left-auto mt-2 w-80 max-w-[calc(100vw-2rem)] bg-(--theme-bg-secondary) border border-(--theme-border-primary) rounded-lg shadow-lg z-50"
    >
      <div className="p-4">
        <h3
          id={titleId}
          className="text-sm font-medium text-(--theme-text-primary) mb-3"
        >
          Time window
        </h3>

        {/* Preset Options */}
        <div className="mb-4">
          {presetGroups.map((item, idx) => {
            if (item === "separator") {
              return (
                <div
                  key={`sep-${idx}`}
                  className="my-1 border-t border-(--theme-border-primary)"
                />
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handlePresetClick(item.label)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary) ${dateRange.preset === item.label
                  ? "bg-(--theme-button-bg) text-white"
                  : "text-(--theme-text-secondary) hover:bg-(--theme-bg-tertiary)"
                  }`}
              >
                <span>{item.label}</span>
                <kbd className={`text-xs font-mono ${dateRange.preset === item.label ? "text-white/60" : "text-(--theme-text-secondary) opacity-50"}`}>
                  {item.shortcut}
                </kbd>
              </button>
            );
          })}
        </div>

        {/* Custom Date Range */}
        <div className="border-t border-(--theme-border-primary) pt-4">
          <h4 className="text-xs font-medium text-(--theme-text-secondary) mb-2">
            Custom Range
          </h4>
          <div className="space-y-2">
            <div>
              <label
                htmlFor={startDateId}
                className="block text-xs text-(--theme-text-secondary) mb-1"
              >
                Start Date
              </label>
              <input
                id={startDateId}
                type="date"
                value={draft.start}
                onChange={(e) =>
                  handleCustomDateChange("start", e.target.value)
                }
                className="w-full px-3 py-2 bg-(--theme-input-bg) border border-(--theme-input-border) rounded text-sm text-(--theme-text-primary) focus:border-(--theme-border-primary) focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor={endDateId}
                className="block text-xs text-(--theme-text-secondary) mb-1"
              >
                End Date
              </label>
              <input
                id={endDateId}
                type="date"
                value={draft.end}
                onChange={(e) => handleCustomDateChange("end", e.target.value)}
                className="w-full px-3 py-2 bg-(--theme-input-bg) border border-(--theme-input-border) rounded text-sm text-(--theme-text-primary) focus:border-(--theme-border-primary) focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Scorecard: React.FC<ScorecardProps> = ({
  title,
  value,
  change,
  changeType,
  changeLabel,
}) => {
  const getChangeIcon = () => {
    if (changeType === "positive") {
      return (
        <svg
          aria-hidden="true"
          focusable="false"
          className="h-4 w-4 text-(--color-secondary) mr-1"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    } else if (changeType === "negative") {
      return (
        <svg
          aria-hidden="true"
          focusable="false"
          className="h-4 w-4 text-danger mr-1"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    } else {
      return (
        <svg
          aria-hidden="true"
          focusable="false"
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-(--theme-text-secondary) mr-1"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <rect y="9" width="20" height="2" />
        </svg>
      );
    }
  };

  const getChangeColor = () => {
    if (changeType === "positive") return "text-(--color-secondary)";
    if (changeType === "negative") return "text-(--color-danger)";
    return "text-(--theme-text-secondary)";
  };

  // Only show the change row if there's actual change data
  const hasChangeData = change !== "" || changeLabel !== "";

  return (
    <div className="bg-(--theme-card-bg) border border-(--theme-card-border) rounded-lg p-4 text-left">
      <h3 className="text-xs font-medium text-(--theme-text-secondary) uppercase tracking-wider mb-1">
        {title}
      </h3>
      <p className="text-2xl font-bold text-(--theme-text-primary) mb-1">
        {value}
      </p>
      {hasChangeData && (
        <div className="flex items-center justify-start">
          {getChangeIcon()}
          <span className="text-xs text-(--theme-text-secondary)">
            <span className={getChangeColor()}>{change}</span> {changeLabel}
          </span>
        </div>
      )}
    </div>
  );
};

