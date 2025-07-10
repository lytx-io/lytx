"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  useContext,
  Suspense,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveLine } from "@nivo/line";

import { AuthContext } from "@/app/AuthProvider";
import {
  type DeviceGeoData,
  type ChartComponentProps,
  type NivoBarChartData,
  type NivoLineChartData,
  type NivoPieChartData,
  type ScorecardProps,
  type TableComponentProps,
  TopSourcesData,
  BrowserData,
  DashboardResponseData,
} from "@db/tranformReports";
// import { useTheme } from "./ThemeProvider";
import { createChartTheme, chartColors } from "./utils/chartThemes";

// Filter interfaces
interface DateRange {
  start: string;
  end: string;
  preset?: string;
}

interface DashboardFilters {
  dateRange: DateRange;
  deviceType?: string;
  country?: string;
  source?: string;
  siteId?: string;
}

// Props for the main DashboardPage (now empty as data is fetched internally)
interface DashboardPageProps {
  PageViewsData?: NivoLineChartData;
  ReferrersData?: NivoPieChartData;
  EventTypesData?: TableComponentProps["tableData"];
  DeviceGeoData?: DeviceGeoData;
  TopPagesData?: NivoBarChartData;
  TopSourcesData?: TopSourcesData;
  BrowserData?: BrowserData;
  DateRange?: {
    auto: "7 days";
  };
}

const SiteSelector: React.FC<{ name?: string, setSiteName: (e: string) => void, sites: Array<{ name: string, site_id: number }> }> = (props) => {
  // const [siteName, setSiteName] = useState(props.name);

  return (
    <div>
      Site : {props.name}
      <select
        onChange={(e) => props.setSiteName(e.target.value)}
        className="bg-[var(--theme-input-bg)] text-sm text-[var(--theme-text-primary)] rounded-md border border-[var(--theme-input-border)] focus:border-[var(--theme-border-primary)] focus:outline-none" >
        {props.sites.map((site) => (
          <option key={site.site_id} value={site.name}>{site.name}</option>
        ))}
      </select>
    </div>

  )
}

// Props for Scorecard component

// --- Scorecard Component ---
const Scorecard: React.FC<ScorecardProps> = ({
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
          className="h-4 w-4 text-[var(--color-secondary)] mr-1"
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
          className="h-4 w-4 text-[var(--color-danger)] mr-1"
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
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-[var(--theme-text-secondary)] mr-1"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <rect y="9" width="20" height="2" />
        </svg>
      );
    }
  };

  const getChangeColor = () => {
    if (changeType === "positive") return "text-[var(--color-secondary)]";
    if (changeType === "negative") return "text-[var(--color-danger)]";
    return "text-[var(--theme-text-secondary)]";
  };

  return (
    <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-lg p-4 flex-1 min-w-[140px] text-left">
      <h3 className="text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider mb-1">
        {title}
      </h3>
      <p className="text-2xl font-bold text-[var(--theme-text-primary)] mb-1">
        {value}
      </p>
      <div className="flex items-center justify-start">
        {getChangeIcon()}
        <span className="text-xs text-[var(--theme-text-secondary)]">
          <span className={getChangeColor()}>{change}</span> {changeLabel}
        </span>
      </div>
    </div>
  );
};

// --- ChartComponent for Nivo ---
const ChartComponent: React.FC<ChartComponentProps> = (props) => {
  const { chartId, chartData, title, height = "350px" } = props;
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);

  const chartTheme = createChartTheme(true);


  const renderChart = () => {
    console.log("Rendering chart", chartData, props.type);
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
          margin={{ top: 50, right: 130, bottom: 50, left: 60 }}
          padding={0.3}
          valueScale={{ type: "linear" }}
          indexScale={{ type: "band", round: true }}
          colors={chartColors.primary}
          borderColor="#1D4ED8"
          borderWidth={2}
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
            barData.legends || [
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
          margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
          innerRadius={0.5}
          padAngle={0.7}
          cornerRadius={3}
          activeOuterRadiusOffset={8}
          borderWidth={1}
          borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
          arcLinkLabelsSkipAngle={10}
          arcLinkLabelsThickness={2}
          arcLinkLabelsColor={{ from: "color" }}
          arcLabelsSkipAngle={10}
          arcLabelsTextColor={{ from: "color", modifiers: [["darker", 2]] }}
          colors={chartColors.mixed}
          legends={
            pieData.legends || [
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
                effects: [{ on: "hover", style: { itemOpacity: 1 } }],
              },
            ]
          }
          theme={chartTheme}
        />
      );
    } else if (props.type === "line") {
      const lineData = chartData as NivoLineChartData;
      return (
        <>
          <span>No data available for this chart</span>
          <ResponsiveLine
            data={lineData?.data || []}
            margin={{ top: 50, right: 20, bottom: 50, left: 20 }}
            xScale={{ type: "point" }}
            yScale={{
              type: "linear",
              min: "auto",
              max: "auto",
              stacked: false,
              reverse: false,
            }}
            colors={["#666665"]}
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
            axisLeft={null}
            axisBottom={{
              // orient: 'bottom',
              tickSize: 0,
              tickPadding: 10,
              tickRotation: 0,
              legend: "",
              legendOffset: 36,
              legendPosition: "middle",
              renderTick: (tick) => (
                <g transform={`translate(${tick.x},${tick.y})`}>
                  <text
                    x={0}
                    y={15}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fill: "#9CA3AF", fontSize: "11px" }}
                  >
                    {String(tick.value)}
                  </text>
                </g>
              ),
            }}
            enableGridX={false}
            enableGridY={true}
            gridYValues={5}
            theme={chartTheme}
            pointSize={8}
            pointColor={{ theme: "background" }}
            pointBorderWidth={2}
            pointBorderColor={{ from: "serieColor" }}
            pointLabelYOffset={-12}
            useMesh={true}
          />
        </>
      );
    }
    return null;
  };

  return (
    <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-lg p-6 mb-6">
      <h2 className="text-xl font-semibold mb-3 text-[var(--theme-text-primary)]">
        {title}
      </h2>
      <div
        ref={chartContainerRef}
        id={chartId}
        style={{
          height: typeof height === "number" ? `${height}px` : height,
          minHeight: typeof height === "number" ? `${height}px` : height,
          position: "relative",
        }}
      >
        {props.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--theme-card-bg)] bg-opacity-75 z-10">
            <div className="animate-pulse flex items-center">
              <svg
                className="w-10 h-10 text-[var(--theme-text-secondary)]"
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
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="ml-3 text-[var(--theme-text-secondary)]">
                Loading chart...
              </span>
            </div>
          </div>
        )}
        {!props.isLoading && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-danger)] bg-opacity-20 p-4 text-center rounded-lg">
            <p className="text-[var(--color-danger)] font-semibold">Error!</p>
            <p className="text-[var(--color-danger)] text-sm opacity-80">
              {error}
            </p>
          </div>
        )}
        {!props.isLoading && !error && chartData && renderChart()}
      </div>
    </div>
  );
};

// --- TableComponent (ensure it's defined as it was previously) ---
const TableComponent: React.FC<TableComponentProps> = ({
  tableId,
  tableData,
  title,
}) => {
  const displayTitle = title || tableData?.title || "Table";
  if (
    !tableData ||
    !tableData.headers ||
    !tableData.rows ||
    tableData.rows.length === 0
  ) {
    return (
      <div
        id={tableId}
        className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-lg p-6 mb-6"
      >
        <h2 className="text-xl font-semibold mb-3 text-[var(--theme-text-primary)]">
          {displayTitle}
        </h2>
        <p className="text-[var(--theme-text-secondary)]">
          No data available for this table.
        </p>
      </div>
    );
  }
  return (
    <div
      id={tableId}
      className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-lg p-6 mb-6"
    >
      <h2 className="text-xl font-semibold mb-3 text-[var(--theme-text-primary)]">
        {displayTitle}
      </h2>
      <table className="min-w-full divide-y divide-[var(--theme-border-primary)]">
        <thead className="bg-[var(--theme-bg-secondary)]">
          <tr>
            {(tableData.headers || []).map((header) => (
              <th
                key={header}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-[var(--theme-card-bg)] divide-y divide-[var(--theme-border-primary)]">
          {(tableData.rows || []).map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="hover:bg-[var(--theme-bg-secondary)] transition-colors"
            >
              {(row || []).map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-6 py-4 whitespace-nowrap text-sm text-[var(--theme-text-primary)]"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Date Picker Component ---
const DatePicker: React.FC<{
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ dateRange, onDateRangeChange, isOpen, onToggle }) => {
  const presets = [
    { label: "Last 7 days", days: 7 },
    { label: "Last 30 days", days: 30 },
    { label: "Last 90 days", days: 90 },
    { label: "Last 6 months", days: 180 },
    { label: "Last year", days: 365 },
  ];

  const getDateFromDaysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split("T")[0];
  };

  const getCurrentDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const handlePresetClick = (days: number, label: string) => {
    console.log(days, label);
    const newRange: DateRange = {
      start: getDateFromDaysAgo(days),
      end: getCurrentDate(),
      preset: label,
    };
    onDateRangeChange(newRange);
    onToggle();
  };

  const handleCustomDateChange = (field: "start" | "end", value: string) => {
    const newRange: DateRange = {
      ...dateRange,
      [field]: value,
      preset: undefined,
    };
    onDateRangeChange(newRange);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] rounded-lg shadow-lg z-50">
      <div className="p-4">
        <h3 className="text-sm font-medium text-[var(--theme-text-primary)] mb-3">
          Date Range
        </h3>

        {/* Preset Options */}
        <div className="space-y-2 mb-4">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePresetClick(preset.days, preset.label)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${dateRange.preset === preset.label
                ? "bg-[var(--theme-button-bg)] text-white"
                : "text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)]"
                }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        <div className="border-t border-[var(--theme-border-primary)] pt-4">
          <h4 className="text-xs font-medium text-[var(--theme-text-secondary)] mb-2">
            Custom Range
          </h4>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-[var(--theme-text-secondary)] mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  handleCustomDateChange("start", e.target.value)
                }
                className="w-full px-3 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded text-sm text-[var(--theme-text-primary)] focus:border-[var(--theme-border-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--theme-text-secondary)] mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => handleCustomDateChange("end", e.target.value)}
                className="w-full px-3 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded text-sm text-[var(--theme-text-primary)] focus:border-[var(--theme-border-primary)] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Filter Modal Component ---
const FilterModal: React.FC<{
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  isOpen: boolean;
  onClose: () => void;
}> = ({ filters, onFiltersChange, isOpen, onClose }) => {
  const [localFilters, setLocalFilters] = useState<DashboardFilters>(filters);

  //WARNING: This is dumb
  // useEffect(() => {
  //   setLocalFilters(filters);
  // }, [filters]);

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleClearFilters = () => {
    const clearedFilters: DashboardFilters = {
      dateRange: filters.dateRange, // Keep date range
      deviceType: undefined,
      country: undefined,
      source: undefined,
      siteId: filters.siteId,
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[var(--theme-bg-secondary)] rounded-lg p-6 w-96 max-w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[var(--theme-text-primary)]">
            Filters
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] transition-colors"
          >
            <svg
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
            <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">
              Device Type
            </label>
            <select
              value={localFilters.deviceType || ""}
              onChange={(e) =>
                setLocalFilters({
                  ...localFilters,
                  deviceType: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded text-sm text-[var(--theme-text-primary)] focus:border-[var(--theme-border-primary)] focus:outline-none"
            >
              <option value="">All Devices</option>
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
              <option value="tablet">Tablet</option>
            </select>
          </div>

          {/* Country Filter */}
          <div>
            <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">
              Country
            </label>
            <select
              value={localFilters.country || ""}
              onChange={(e) =>
                setLocalFilters({
                  ...localFilters,
                  country: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded text-sm text-[var(--theme-text-primary)] focus:border-[var(--theme-border-primary)] focus:outline-none"
            >
              <option value="">All Countries</option>
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="GB">United Kingdom</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="JP">Japan</option>
            </select>
          </div>

          {/* Traffic Source Filter */}
          <div>
            <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">
              Traffic Source
            </label>
            <select
              value={localFilters.source || ""}
              onChange={(e) =>
                setLocalFilters({
                  ...localFilters,
                  source: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded text-sm text-[var(--theme-text-primary)] focus:border-[var(--theme-border-primary)] focus:outline-none"
            >
              <option value="">All Sources</option>
              <option value="google">Google</option>
              <option value="direct">Direct</option>
              <option value="facebook">Facebook</option>
              <option value="twitter">Twitter</option>
              <option value="linkedin">LinkedIn</option>
              <option value="referral">Referral</option>
            </select>
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={handleClearFilters}
            className="flex-1 px-4 py-2 bg-[var(--theme-input-bg)] text-[var(--theme-text-secondary)] border border-[var(--theme-input-border)] rounded hover:bg-[var(--theme-bg-secondary)] transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={handleApplyFilters}
            className="flex-1 px-4 py-2 bg-[var(--theme-button-bg)] text-white rounded hover:bg-[var(--theme-button-hover)] transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

type ScoreCards = "uniqueVisitors" | "totalPageViews" | "bounceRate" | "avgSessionDuration" | "conversionRate" | "newUsers"
type ScoreCardStats = Record<ScoreCards, { value: number, change: number }>
// --- DashboardPage (fetches its own data) ---
export const DashboardPage: React.FC<DashboardPageProps> = (props) => {
  const [worldMapFeatures, setWorldMapFeatures] = useState<any[] | null>(null);
  const { PageViewsData, EventTypesData, DeviceGeoData, ReferrersData } = props;
  const [siteName, setSiteName] = useState<string | undefined>();
  const [siteScoreCards, setSiteScoreCards] = useState<ScoreCardStats>({
    uniqueVisitors: { value: 0, change: 0 },
    totalPageViews: { value: 0, change: 0 },
    bounceRate: { value: 0, change: 0 },
    avgSessionDuration: { value: 0, change: 0 },
    conversionRate: { value: 0, change: 0 },
    newUsers: { value: 0, change: 0 }
  });

  const { data: session, isPending: isSessionLoading } = useContext(
    AuthContext,
  ) || { data: null, isPending: true };

  // Initialize default date range (last 7 days) - memoized to prevent recreating
  const defaultDateRange = useMemo((): DateRange => {
    const end = new Date().toISOString().split("T")[0];
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return {
      start: start.toISOString().split("T")[0],
      end,
      preset: "Last 7 days",
    };
  }, []);

  // Filter state management
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: defaultDateRange,
    deviceType: undefined,
    country: undefined,
    source: undefined,
    siteId: session?.userSites?.[0]?.site_id?.toString(),
  });

  // UI state for modals
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);


  // React Query for dashboard data fetching
  const { data: apiData, error: queryError, isLoading } = useQuery({
    queryKey: ["dashboardData", filters, session?.userSites?.[0]?.site_id],
    queryFn: async ({ queryKey }) => {
      const [_key, dataFilters] = queryKey;
      // console.log("Query function", dataFilters);

      if (!session?.userSites?.[0]?.site_id) {
        throw new Error("No site ID available");
      }

      const response = await fetch("/api/dashboard/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: session.userSites[0].site_id,
          date_start: filters.dateRange.start,
          date_end: filters.dateRange.end,
          device_type: filters.deviceType,
          country: filters.country,
          source: filters.source,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      // console.log("We fetched the data", session);
      if (session) {

        // setSiteName(session.userSites[0].name ?? "Name not set");
      }

      return response.json() as Promise<DashboardResponseData>;
    },
    enabled: !isSessionLoading && !!session?.userSites?.[0]?.site_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  //WARNING: Just using for debugging
  useEffect(() => {
    console.log("Api data", apiData, isLoading);
  }, [isLoading]);

  // Dashboard data derived from React Query or props only (no dummy data fallbacks)
  const dashboardData = {
    topPagesData: apiData?.TopPagesData || props.TopPagesData,
    topSourcesData: apiData?.TopSourcesData || props.TopSourcesData,
    browserData: apiData?.BrowserData || props.BrowserData,
    pageViewsData: apiData?.PageViewsData || PageViewsData,
    referrersData: apiData?.ReferrersData || ReferrersData,
    eventTypesData: apiData?.EventTypesData || EventTypesData,
    deviceGeoData: apiData?.DeviceGeoData || DeviceGeoData,
  };

  // Tab state management
  const [topSourcesTab, setTopSourcesTab] = useState<"Sources" | "Referrers">(
    "Sources",
  );
  const [topPagesTab, setTopPagesTab] = useState<"By Views" | "By Exits">(
    "By Views",
  );
  const [locationsTab, setLocationsTab] = useState<"Countries" | "Cities">(
    "Countries",
  );
  const [devicesTab, setDevicesTab] = useState<"Browser" | "OS">("Browser");

  // Additional data for different tabs
  const [osData] = useState<BrowserData>([
    { name: "Windows", visitors: 3500, percentage: "50%" },
    { name: "macOS", visitors: 2100, percentage: "30%" },
    { name: "Linux", visitors: 700, percentage: "10%" },
    { name: "Android", visitors: 700, percentage: "10%" },
  ]);
  const [exitPagesData] = useState<NivoBarChartData>({
    options: { chart: { type: "bar" as const } },
    data: [
      { id: "/checkout", value: 850 },
      { id: "/contact", value: 720 },
      { id: "/pricing", value: 650 },
      { id: "/blog/article-2", value: 580 },
      { id: "/about-us", value: 420 },
    ],
    keys: ["value"],
    indexBy: "id",
  });
  const [citiesData] = useState<
    Array<[string, { count: number; country: string }]>
  >([
    ["Toronto", { count: 1200, country: "Canada" }],
    ["New York", { count: 980, country: "USA" }],
    ["London", { count: 750, country: "UK" }],
    ["Paris", { count: 620, country: "France" }],
    ["Tokyo", { count: 580, country: "Japan" }],
  ]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: DashboardFilters) => {
    setFilters(newFilters);
  }, []);

  // Handle date range changes
  // const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
  //   const newFilters = { ...filters, dateRange: newDateRange };
  //   handleFiltersChange(newFilters);
  // }, [filters, handleFiltersChange]);

  async function handleDateRangeChange(newDateRange: DateRange) {
    console.log(newDateRange, "trigger refetch");

    setFilters((prevFilters) => ({
      ...prevFilters,
      dateRange: newDateRange,
    }));
  }


  // Format date range display
  const getDateRangeDisplay = () => {
    if (filters.dateRange.preset) {
      return filters.dateRange.preset;
    }
    return `${filters.dateRange.start} to ${filters.dateRange.end}`;
  };
  useEffect(() => {
    fetch(`/api/world_countries`, {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({ include: [] }),
    })
      .then((res) => res.json())
      .then((geojson: any) => {
        setWorldMapFeatures(geojson.features);
      })
      .catch((error) =>
        console.error("Failed to load world map features:", error),
      ); // NOSONAR
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Navigation Bar */}

      {/* Control Bar */}
      <div className="flex items-center justify-between w-full p-6 border-t border-b border-[var(--theme-border-primary)]">
        <div className="flex items-center space-x-3">
          <span
            className="text-[var(--theme-text-primary)] font-semibold">
            <SiteSelector
              name={session && session.userSites ? siteName : ""}
              setSiteName={setSiteName}
              sites={(session && session.userSites) ? session.userSites.map((sites) => {
                {
                  return {
                    name: sites.name ?? "Name not set",
                    site_id: sites.site_id
                  }
                }
              }
              ) : []} />
          </span>
          <div className="flex items-center space-x-1">
            <svg
              className="h-3 w-3 fill-current text-[var(--color-secondary)]"
              viewBox="0 0 8 8"
            >
              <circle cx="4" cy="4" r="3" />
            </svg>
            <span className="text-sm text-[var(--theme-text-secondary)]">
              69 Current Visitors
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-3 relative">
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className="bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-primary)] font-medium py-2 px-4 rounded-md border border-[var(--theme-border-primary)] transition-colors"
          >
            Filter
          </button>
          <div className="relative">
            <button
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-primary)] py-2 px-4 rounded-md border border-[var(--theme-border-primary)] cursor-pointer transition-colors flex items-center space-x-2"
            >
              <span>{getDateRangeDisplay()}</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <DatePicker
              dateRange={filters.dateRange}
              onDateRangeChange={handleDateRangeChange}
              isOpen={isDatePickerOpen}
              onToggle={() => setIsDatePickerOpen(!isDatePickerOpen)}
            />
          </div>
        </div>
      </div>
      <Suspense fallback={<></>}>
        {/* Main Content Area */}
        <main className="flex-1 p-8 overflow-y-auto">
          {/* KPI Metrics Row */}
          <section className="flex flex-row flex-wrap lg:flex-nowrap justify-between gap-4 mb-8">
            <Scorecard
              title="UNIQUE VISITORS"
              value={siteScoreCards.uniqueVisitors.value.toString()}
              change={siteScoreCards.uniqueVisitors.change.toString()}
              changeType="positive"
              changeLabel="vs last month"
            />
            <Scorecard
              title="TOTAL PAGEVIEWS"
              value={siteScoreCards.totalPageViews.value.toString()}
              change={siteScoreCards.totalPageViews.change.toString()}
              changeType="positive"
              changeLabel="vs last month"
            />
            <Scorecard
              title="BOUNCE RATE"
              value={siteScoreCards.bounceRate.value.toString()}
              change={siteScoreCards.bounceRate.change.toString()}
              changeType="negative"
              changeLabel="vs last month"
            />
            <Scorecard
              title="AVG. SESSION DURATION"
              value={siteScoreCards.avgSessionDuration.value.toString()}
              change={siteScoreCards.avgSessionDuration.change.toString()}
              changeType="positive"
              changeLabel="vs last month"
            />
            <Scorecard
              title="CONVERSION RATE"
              value={siteScoreCards.conversionRate.value.toString()}
              change={siteScoreCards.conversionRate.change.toString()}
              changeType="positive"
              changeLabel="vs last month"
            />
            <Scorecard
              title="NEW USERS"
              value={siteScoreCards.newUsers.value.toString()}
              change={siteScoreCards.newUsers.change.toString()}
              changeType="neutral"
              changeLabel="vs last month"
            />
          </section>

          {/* Main Visualization Area */}
          {/* This section itself is already styled as a card: bg-white p-4 shadow rounded-lg */}
          {/* So, ChartComponents can be direct children or wrapped in a grid for layout */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-6 text-[var(--theme-text-primary)]">
              Key Metrics Visualized
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Page Views Chart - takes full width on small, half on large */}
              <div className="lg:col-span-2">
                <ChartComponent
                  chartId="pageViewsChart"
                  chartData={dashboardData.pageViewsData}
                  isLoading={isLoading}
                  type="line"
                  title="Page Views"
                />
              </div>
              {/* Referrers Chart */}
              <ChartComponent
                chartId="referrersChart"
                chartData={dashboardData.referrersData}
                title="Referrers"
                type="pie"
                isLoading={isLoading}

              />
              {/* Device Types Chart - part of deviceGeoData */}
              {dashboardData.deviceGeoData && (
                <ChartComponent
                  chartId="deviceTypesChart"
                  chartData={dashboardData.deviceGeoData.deviceTypes}
                  title="Device Types"
                  type="pie"
                  isLoading={isLoading}

                />
              )}
            </div>
          </section>

          {/* Detailed Information Grid (2x2) */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Top Sources Card (Top-Left) */}
            <div className="bg-[var(--theme-card-bg)] rounded-lg p-6">
              <h3 className="text-xl font-semibold text-[var(--theme-text-primary)] mb-3">
                Top Sources
              </h3>
              <CardTabs
                tabs={["Sources", "Referrers"]}
                activeTab={topSourcesTab}
                onTabClick={(tab) =>
                  setTopSourcesTab(tab as "Sources" | "Referrers")
                }
              />
              <ul className="space-y-3">
                {topSourcesTab === "Sources"
                  ? (dashboardData.topSourcesData || []).map((source: any) => (
                    <li
                      key={source.name}
                      className="flex items-center justify-between py-2 border-b border-[var(--theme-border-primary)] last:border-b-0"
                    >
                      <div className="flex items-center">
                        <span
                          className={`w-4 h-4 rounded-full mr-3 ${source.name === "Google" ? "bg-red-500" : source.name === "Direct" ? "bg-blue-500" : source.name === "Facebook" ? "bg-gray-500" : "bg-green-500"}`}
                        ></span>
                        <span className="text-sm text-[var(--theme-text-primary)]">
                          {source.name}
                        </span>
                      </div>
                      <span className="text-sm text-[var(--theme-text-primary)] font-medium">
                        {source.visitors.toLocaleString()}
                      </span>
                    </li>
                  ))
                  : (dashboardData.referrersData?.data || []).map(
                    (referrer: any) => (
                      <li
                        key={referrer.id}
                        className="flex items-center justify-between py-2 border-b border-[var(--theme-border-primary)] last:border-b-0"
                      >
                        <div className="flex items-center">
                          <span
                            className={`w-4 h-4 rounded-full mr-3 ${referrer.id === "Google" ? "bg-red-500" : referrer.id === "Direct" ? "bg-blue-500" : referrer.id === "Facebook" ? "bg-gray-500" : "bg-green-500"}`}
                          ></span>
                          <span className="text-sm text-[var(--theme-text-primary)]">
                            {referrer.id}
                          </span>
                        </div>
                        <span className="text-sm text-[var(--theme-text-primary)] font-medium">
                          {referrer.value.toLocaleString()}
                        </span>
                      </li>
                    ),
                  )}
              </ul>
            </div>

            {/* Top Pages Card (Top-Right) */}
            <div className="bg-[var(--theme-card-bg)] rounded-lg p-6">
              <h3 className="text-xl font-semibold text-[var(--theme-text-primary)] mb-3">
                Top Pages
              </h3>
              <CardTabs
                tabs={["By Views", "By Exits"]}
                activeTab={topPagesTab}
                onTabClick={(tab) =>
                  setTopPagesTab(tab as "By Views" | "By Exits")
                }
              />
              <div style={{ height: "250px" }}>
                <ResponsiveBar
                  data={
                    topPagesTab === "By Views"
                      ? dashboardData.topPagesData?.data || []
                      : exitPagesData?.data || []
                  }
                  keys={
                    topPagesTab === "By Views"
                      ? dashboardData.topPagesData?.keys || []
                      : exitPagesData?.keys || []
                  }
                  indexBy={
                    topPagesTab === "By Views"
                      ? dashboardData.topPagesData?.indexBy || "page"
                      : exitPagesData?.indexBy || "page"
                  }
                  layout="horizontal"
                  margin={{ top: 10, right: 10, bottom: 20, left: 120 }} // Adjusted margins
                  padding={0.3}
                  colors={["#3B82F6"]}
                  borderColor="#1D4ED8"
                  borderWidth={2}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={null}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 10, // Increased padding
                    tickRotation: 0,
                    legend: "",
                    renderTick: (tick) => (
                      <g transform={`translate(${tick.x - 110},${tick.y})`}>
                        {" "}
                        {/* Adjusted for centering */}
                        <text
                          textAnchor="start"
                          dominantBaseline="middle"
                          style={{
                            fill: "var(--theme-text-secondary)",
                            fontSize: "11px",
                          }}
                        >
                          {tick.value.length > 15
                            ? tick.value.substring(0, 14) + "..."
                            : tick.value}
                        </text>
                      </g>
                    ),
                  }}
                  enableGridX={true}
                  enableGridY={false}
                  gridXValues={5}
                  enableLabel={false} // Labels on bars themselves disabled for this design
                  isInteractive={true}
                  tooltip={({ id, value, color }) => (
                    <div
                      style={{
                        padding: "6px 10px",
                        background: "#1F2937",
                        color: "#F9FAFB",
                        border: `1px solid ${color}`,
                        borderRadius: "3px",
                        fontSize: "12px",
                      }}
                    >
                      <strong>{id}</strong>: {value.toLocaleString()}
                    </div>
                  )}
                  theme={{
                    axis: {
                      ticks: { text: { fill: "var(--theme-text-secondary)" } },
                    },
                    grid: {
                      line: {
                        stroke: "var(--theme-border-primary)",
                        strokeDasharray: "2 2",
                      },
                    }, // Fainter grid lines
                  }}
                />
              </div>
            </div>

            {/* Locations Card (Bottom-Left) */}
            <div className="bg-[var(--theme-card-bg)] rounded-lg p-6">
              <h3 className="text-xl font-semibold text-[var(--theme-text-primary)] mb-3">
                Locations
              </h3>
              <CardTabs
                tabs={["Countries", "Cities"]}
                activeTab={locationsTab}
                onTabClick={(tab) =>
                  setLocationsTab(tab as "Countries" | "Cities")
                }
              />
              <div style={{ height: "300px" }}>
                {locationsTab === "Countries" ? (
                  !worldMapFeatures ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-[var(--theme-text-secondary)]">
                        Loading map data...
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-[var(--theme-text-secondary)]">
                        No location data available
                      </p>
                    </div>
                  )
                ) : (
                  <ul className="space-y-3 pt-4 overflow-y-auto max-h-[260px]">
                    {(citiesData || []).map(([city, details]) => (
                      <li
                        key={city}
                        className="flex items-center justify-between py-2 border-b border-[var(--theme-border-primary)] last:border-b-0"
                      >
                        <div className="flex items-center">
                          <span className="w-4 h-4 rounded-full mr-3 bg-blue-500"></span>
                          <div className="flex flex-col">
                            <span className="text-sm text-[var(--theme-text-primary)]">
                              {city}
                            </span>
                            <span className="text-xs text-[var(--theme-text-secondary)]">
                              {details.country}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm text-[var(--theme-text-primary)] font-medium">
                          {details.count.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Devices Card (Bottom-Right) */}
            <div className="bg-[var(--theme-card-bg)] rounded-lg p-6">
              <h3 className="text-xl font-semibold text-[var(--theme-text-primary)] mb-3">
                Devices
              </h3>
              <CardTabs
                tabs={["Browser", "OS"]}
                activeTab={devicesTab}
                onTabClick={(tab) => setDevicesTab(tab as "Browser" | "OS")}
              />
              <ul className="space-y-3 pt-4">
                {(devicesTab === "Browser"
                  ? dashboardData.browserData || []
                  : osData || []
                ).map((device: any) => (
                  <li
                    key={device.name}
                    className="flex items-center justify-between py-2 border-b border-[var(--theme-border-primary)] last:border-b-0"
                  >
                    <div className="flex items-center">
                      <span
                        className={`w-4 h-4 rounded-full mr-3 ${devicesTab === "Browser"
                          ? device.name === "Chrome"
                            ? "bg-green-500"
                            : device.name === "Safari"
                              ? "bg-blue-500"
                              : device.name === "Firefox"
                                ? "bg-orange-500"
                                : "bg-sky-500"
                          : device.name === "Windows"
                            ? "bg-blue-600"
                            : device.name === "macOS"
                              ? "bg-gray-500"
                              : device.name === "Linux"
                                ? "bg-yellow-500"
                                : "bg-green-600"
                          }`}
                      ></span>
                      <span className="text-sm text-[var(--theme-text-primary)]">
                        {device.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-[var(--theme-text-primary)] font-medium">
                        {device.visitors.toLocaleString()}
                      </span>
                      <span className="text-xs text-[var(--theme-text-secondary)]">
                        ({device.percentage})
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Restored Detailed Data Section */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-6 text-[var(--theme-text-primary)]">
              Other Detailed Data
            </h2>
            {(() => {
              const eventTypesTableData = dashboardData.eventTypesData;
              if (eventTypesTableData) {
                return (
                  <TableComponent
                    tableId="eventTypesTable"
                    tableData={eventTypesTableData}
                  // title is already part of eventTypesTableData or defaults in TableComponent
                  />
                );
              }
              return null;
            })()}

            {dashboardData.deviceGeoData &&
              dashboardData.deviceGeoData.geoData &&
              (() => {
                const geoDataTableData = dashboardData.deviceGeoData.geoData;
                // Add margin top if the eventTypesTable was rendered
                const marginTopClass = dashboardData.eventTypesData
                  ? "mt-8"
                  : "";
                return (
                  <div className={marginTopClass}>
                    <TableComponent
                      tableId="geoDataTable"
                      tableData={geoDataTableData}
                    // title is already part of geoDataTableData or defaults in TableComponent
                    />
                  </div>
                );
              })()}
          </section>
        </main>
      </Suspense>

      {/* Filter Modal */}
      <FilterModal
        filters={filters}
        onFiltersChange={handleFiltersChange}
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
      />

      {/* Error Display */}
      {queryError && (
        <div className="fixed top-4 right-4 bg-[var(--color-danger)] text-white p-4 rounded-lg shadow-lg z-50">
          <p className="font-semibold">Error loading dashboard data</p>
          <p className="text-sm">{queryError.message}</p>
        </div>
      )}
    </div>
  );
};

// Mock Data Functions providing Nivo-ready data

// Placeholder Tab Component (Reusable)
const CardTabs: React.FC<{
  tabs: string[];
  activeTab: string;
  onTabClick: (tab: string) => void;
}> = ({ tabs, activeTab, onTabClick }) => (
  <div className="flex border-b border-[var(--theme-border-primary)] mb-4">
    {tabs.map((tab) => (
      <button
        key={tab}
        onClick={() => onTabClick(tab)}
        className={`py-2 px-4 font-semibold ${activeTab === tab
          ? "text-[var(--theme-text-primary)] border-b-2 border-[var(--theme-border-primary)]"
          : "text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
          }`}
      >
        {tab}
      </button>
    ))}
  </div>
);

export default DashboardPage;
