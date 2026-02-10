import { DasboardDataResult, Pagination } from "@db/types";

export interface NivoBarChartData {
  data: Record<string, any>[];
  keys: string[];
  indexBy: string;
  axisBottom?: any;
  axisLeft?: any;
  legends?: any[];
  options: { chart: { type: "bar" } }; // Mandatory type
}

export interface NivoPieChartData {
  data: { id: string | number; value: number }[];
  legends?: any[];
  options: { chart: { type: "pie" } }; // Mandatory type
}

export interface NivoLineChartData {
  data: {
    id: string | number;
    data: { x: string | number; y: string | number }[];
  }[];
  legends?: any[]; // Optional
  options: { chart: { type: "line" } }; // Mandatory type
  axisBottom?: any; // Optional, can be customized per chart
  axisLeft?: any; // Optional
  // Add other line-specific Nivo props if they need to be dynamic from data source
}

export type NivoChartData =
  | NivoBarChartData
  | NivoPieChartData
  | NivoLineChartData;

export type ScoreCardLabels =
  | "Uniques"
  | "Total Page Views"
  | "Bounce Rate"
  | "Conversion Rate"
  | "Revenue"
  | "Avg Session Duration"
  | "avg_time_on_page"
  | "pages_per_session"
  | "new_users";
export interface ScorecardProps {
  title: ScoreCardLabels;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  changeLabel: string;
}

export interface ChartComponentProps {
  chartId: string;
  chartData: NivoChartData | null | undefined;
  title: string;
  isLoading: boolean;
  type: "bar" | "pie" | "line";
  height?: string | number;
  onItemClick?: (id: string) => void;
}

// Props for TableComponent
export interface TableComponentProps {
  tableId: string;
  tableData:
  | {
    headers: string[];
    rows: (string | number)[][];
    title?: string;
  }
  | null
  | undefined;
  title?: string;
}

// Helper function to serialize data for client components
function serializeForClient<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (value === undefined) {
        return null;
      }
      return value;
    }),
  );
}
function scoreCardCounts(data: DasboardDataResult): Array<ScorecardProps> {
  // Scorecards are derived from raw event rows for a site/date range.
  // `rid` is treated as a "session id"; we use distinct `rid` values as "unique visitors".
  let uniqueCount = 0;

  // Total page views = number of `page_view` events.
  const totalPageViewsCount = data.filter((d) => d.event == "page_view").length;

  // Unique visitors = count of distinct `rid` values.
  if (data.length > 0) {
    const uniqueMap = new Map<string, number>();
    for (const item of data) {
      if (!item.rid) continue;
      const check = uniqueMap.get(item.rid);
      uniqueMap.set(item.rid, check ? check + 1 : 1);
    }
    const ridsArray = Array.from(uniqueMap);
    uniqueCount = ridsArray.length;
  }

  const uniques: ScorecardProps = {
    title: "Uniques",
    value: `${uniqueCount.toLocaleString()}`,
    change: "",
    changeType: "neutral",
    changeLabel: "",
  };
  const totalPageViews: ScorecardProps = {
    title: "Total Page Views",
    value: `${totalPageViewsCount.toLocaleString()}`,
    change: "",
    changeType: "neutral",
    changeLabel: "",
  };
  // Bounce rate = % of sessions (`rid`) with exactly one page view.
  const sessionPageViews = new Map<string, number>();
  data
    .filter((d) => d.event === "page_view" && d.rid)
    .forEach((d) => {
      const current = sessionPageViews.get(d.rid!) || 0;
      sessionPageViews.set(d.rid!, current + 1);
    });
  const singlePageSessions = Array.from(sessionPageViews.values()).filter(
    (count) => count === 1,
  ).length;
  const bounceRatePercent =
    uniqueCount > 0
      ? ((singlePageSessions / uniqueCount) * 100).toFixed(1)
      : "0";

  // Conversion rate = % of sessions (`rid`) that include a conversion-like event.
  const conversionEvents = data.filter(
    (d) => d.event === "conversion" || d.event === "purchase",
  ).length;
  const conversionRatePercent =
    uniqueCount > 0
      ? ((conversionEvents / uniqueCount) * 100).toFixed(2)
      : "0.00";

  // Calculate total revenue - placeholder since no value field exists
  const totalRevenue = 0; // Would need a value field in the data structure

  // Average session duration (simplified): per `rid`, take (max(createdAt)-min(createdAt)).
  const sessionTimes = new Map<string, { first: Date; last: Date }>();
  data
    .filter((d) => d.rid && d.createdAt)
    .forEach((d) => {
      const timestamp = d.createdAt!;
      const existing = sessionTimes.get(d.rid!);
      if (!existing) {
        sessionTimes.set(d.rid!, { first: timestamp, last: timestamp });
      } else {
        if (timestamp < existing.first) existing.first = timestamp;
        if (timestamp > existing.last) existing.last = timestamp;
      }
    });

  const sessionDurations = Array.from(sessionTimes.values()).map(
    ({ first, last }) => (last.getTime() - first.getTime()) / 1000,
  ); // in seconds
  const avgDuration =
    sessionDurations.length > 0
      ? sessionDurations.reduce((sum, duration) => sum + duration, 0) /
      sessionDurations.length
      : 0;
  const avgDurationFormatted =
    avgDuration > 60
      ? `${Math.floor(avgDuration / 60)}m ${Math.floor(avgDuration % 60)}s`
      : `${Math.floor(avgDuration)}s`;

  const bounceRate: ScorecardProps = {
    title: "Bounce Rate",
    value: `${bounceRatePercent}%`,
    change: "",
    changeType: "neutral",
    changeLabel: "",
  };
  const conversionRate: ScorecardProps = {
    title: "Conversion Rate",
    value: `${conversionRatePercent}%`,
    change: "",
    changeType: "neutral",
    changeLabel: "",
  };
  const revenue: ScorecardProps = {
    title: "Revenue",
    value: `$${totalRevenue.toLocaleString()}`,
    change: "",
    changeType: "neutral",
    changeLabel: "",
  };
  const avgSessionDuration: ScorecardProps = {
    title: "Avg Session Duration",
    value: avgDurationFormatted,
    change: "",
    changeType: "neutral",
    changeLabel: "",
  };
  // const pagesPerSession: ScorecardProps = {
  //   title: "Pages per Session",
  //   value: "12,345",
  //   change: "",
  //   changeType: "neutral",
  //   changeLabel: "",
  // };
  // const newUsers: ScorecardProps = {
  //   title: "New Users",
  //   value: "12,345",
  //   change: "",
  //   changeType: "neutral",
  //   changeLabel: "",
  // };

  return [
    uniques,
    totalPageViews,
    bounceRate,
    conversionRate,
    revenue,
    avgSessionDuration,
    // avgTimeOnPage,
    // pagesPerSession,
    // newUsers,
  ];
}

export function transformToChartData(data: DasboardDataResult) {
  // Group the data by date
  const dateCountMap = new Map<string, number>();
  const eventCountMap = new Map<string, number>();
  const refererCountMap = new Map<string, number>();
  const debvCountMap = new Map<string, number>();
  const topPagesMap = new Map<string, number>();
  const browserMap = new Map<string, number>();
  const osMap = new Map<string, number>();

  const cityMap = new Map<string, { count: number; country: string }>();

  // Array<{ id: string, value: number }

  data.forEach((item) => {
    const currentCount = eventCountMap.get(item.event!) || 0;
    eventCountMap.set(item.event!, currentCount + 1);
    const currentCity = cityMap.get(item.city!);
    if (currentCity) {
      currentCity.count++;
    } else {
      cityMap.set(item.city!, { count: 1, country: item.country! });
    }

    const currentReferer =
      refererCountMap.get(cleanReferer(item.referer!)) || 0;
    refererCountMap.set(cleanReferer(item.referer!), currentReferer + 1);

    const deviceType = item.device_type || "Unknown";
    const currentDebv = debvCountMap.get(deviceType) || 0;
    debvCountMap.set(deviceType, currentDebv + 1);

    const currentBrowser = browserMap.get(item.browser!) || 0;
    browserMap.set(item.browser!, currentBrowser + 1);

    // Aggregate operating system data
    if (item.operating_system) {
      const currentOs = osMap.get(item.operating_system) || 0;
      osMap.set(item.operating_system, currentOs + 1);
    }

    const currentTopPage = topPagesMap.get(item.client_page_url!) || 0;
    topPagesMap.set(item.client_page_url!, currentTopPage + 1);

    if (item.event === "page_view") {
      // Format the date (extract just the YYYY-MM-DD part)
      const dateStr = item.createdAt!.toISOString().split("T")[0];

      // Increment the count for this date
      const currentCount = dateCountMap.get(dateStr) || 0;
      dateCountMap.set(dateStr, currentCount + 1);
    }
  });

  // Convert the map to the required output format
  const result = Array.from(dateCountMap.entries()).map(([date, count]) => ({
    x: date,
    y: count,
  }));

  // Sort by date
  result.sort((a, b) => a.x.localeCompare(b.x));

  const transformedData = {
    pageViews: result,
    scoreCards: scoreCardCounts(data),
    events: Array.from(eventCountMap.entries()),
    devices: Array.from(debvCountMap.entries()),
    browsers: Array.from(browserMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map((a) => {
        return { id: a[0], value: a[1] };
      }),
    operatingSystems: Array.from(osMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map((a) => {
        return { id: a[0], value: a[1] };
      }),
    cities: Array.from(cityMap.entries()).sort(
      (a, b) => b[1].count - a[1].count,
    ),
    topPages: Array.from(topPagesMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map((a) => {
        return { id: a[0], value: a[1] };
      }),
    referers: Array.from(refererCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map((a) => {
        return { id: a[0], value: a[1] };
      }),
  };

  // Ensure all data is serializable for client components
  return serializeForClient(transformedData);
}

export function getPageViewsData(
  data?: Array<{ x: string; y: number }>,
): NivoLineChartData {
  const points = (data || []).map((item) => ({
    x: item.x,
    y: item.y,
  }));

  return {
    options: { chart: { type: "line" as const } },
    data: [
      {
        id: "Page Views",
        data: points,
      },
    ],
  };
}

// function getDateTickValues(values: string[]): string[] | undefined {
//   const total = values.length;
//   if (total <= 10) return values;
//
//   const targetTicks = total <= 30 ? 8 : total <= 90 ? 10 : 12;
//   const step = Math.max(1, Math.ceil(total / targetTicks));
//   const ticks = values.filter((_, index) => index % step === 0);
//   const last = values[values.length - 1];
//
//   if (ticks[ticks.length - 1] !== last) {
//     ticks.push(last);
//   }
//
//   return ticks;
// }

// function formatDateTick(value: string | number): string {
//   const raw = String(value);
//
//   if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
//     const parts = raw.split("-");
//     return `${parts[1]}/${parts[2]}`;
//   }
//
//   if (/^\d{4}-\d{2}$/.test(raw)) {
//     const parts = raw.split("-");
//     return `${parts[1]}/${parts[0]}`;
//   }
//
//   return raw;
// }

export function getEventTypesData(
  data?: Array<[string, number]>,
): TableComponentProps["tableData"] {
  const defaultData = [
    ["page_view", 2500],
    ["add_to_cart", 300],
    ["checkout_start", 150],
    ["video_play", 500],
    ["download_pdf", 120],
  ];
  return {
    headers: ["Event Name", "Count"],
    rows: data || defaultData,
    title: "Event Types",
  };
}

export function getDeviceGeoData(data?: {
  deviceData?: Array<[string, number]>;
  geoData?: Array<[string, string, number]>;
}) {
  let defaultDeviceData = [
    { id: "Desktop", value: 65 },
    { id: "Mobile", value: 25 },
    { id: "Tablet", value: 10 },
  ];
  if (data) {
    if (data.deviceData) {
      defaultDeviceData = data.deviceData.map(([id, value]) => ({ id, value }));
    }
  }

  const defaultGeoData = [["Canada", "Toronto", 400]];

  return {
    deviceTypes: {
      options: { chart: { type: "pie" as const } },
      data: defaultDeviceData,
    },
    geoData: {
      headers: ["Country", "City", "Views"],
      rows: data?.geoData || defaultGeoData,
      title: "Top Geo Locations",
    },
  };
}

export function getTopSourcesData(
  data?: Array<{ name: string; visitors: number }>,
) {
  const defaultData = [
    { name: "Google", visitors: 5200, icon: "google.svg" },
    { name: "Direct", visitors: 2100, icon: "direct.svg" },
    { name: "Facebook", visitors: 1500, icon: "facebook.svg" },
    { name: "Twitter", visitors: 900, icon: "twitter.svg" },
  ];
  return data || defaultData;
}

export function getTopPagesData(
  data?: Array<{ id: string; value: number }>,
): NivoBarChartData {
  const defaultData = [
    { id: "/home", value: 3050 },
    { id: "/products", value: 2200 },
    { id: "/about-us", value: 1800 },
    { id: "/blog/article-1", value: 1200 },
    { id: "/contact", value: 950 },
  ];
  return {
    options: { chart: { type: "bar" as const } },
    data: data || defaultData,
    keys: ["value"],
    indexBy: "id",
  };
}

export function getDeviceData(
  data?: Array<{ name: string; visitors: number; percentage: string }>,
) {
  const defaultData = [
    { name: "Chrome", visitors: 4500, percentage: "60%", icon: "chrome.svg" },
    { name: "Safari", visitors: 1500, percentage: "20%", icon: "safari.svg" },
    { name: "Firefox", visitors: 900, percentage: "12%", icon: "firefox.svg" },
    { name: "Edge", visitors: 600, percentage: "8%", icon: "edge.svg" },
  ];
  return data || defaultData;
}

export function getGoalConversionData(
  data?: (string | number)[][],
): TableComponentProps["tableData"] {
  const defaultData = [
    ["Account Signup", 1500, 1800, "83.33"],
    ["Newsletter Subscription", 800, 950, "84.21"],
    ["Demo Request", 300, 320, "93.75"],
    ["Contact Form Submission", 450, 470, "95.74"],
    ["Software Download", 600, 680, "88.24"],
  ];
  return {
    title: "Goal Conversions",
    headers: ["Goal", "Uniques", "Total", "CR (%)"],
    rows: data || defaultData,
  };
}

function cleanReferer(referer: string) {
  if (!referer) return "Direct";
  if (referer === "") return "Direct";
  return referer.replace(/https?:\/\//, "").replace(/\/.*/, "");
}

export function getLocationsMapData(): Array<{ id: string; value: number }> {
  return [{ id: "CAN", value: 300 }];
}

export function getReferrersData(
  data?: Array<{ id: string; value: number }>,
): NivoPieChartData {
  const defaultData = [
    { id: "Google", value: 44 },
    { id: "Direct", value: 55 },
    { id: "Facebook", value: 13 },
    { id: "Twitter", value: 43 },
    { id: "LinkedIn", value: 22 },
  ];
  return {
    options: { chart: { type: "pie" as const } },
    data: data || defaultData,
  };
}
export type DashboardResponseData = {
  noSiteRecordsExist: boolean;
  ScoreCards: Array<ScorecardProps>;
  PageViewsData: NivoLineChartData;
  EventTypesData: ReturnType<typeof getEventTypesData>;
  DeviceGeoData: ReturnType<typeof getDeviceGeoData>;
  ReferrersData: NivoPieChartData;
  TopPagesData: NivoBarChartData;
  TopSourcesData: ReturnType<typeof getTopSourcesData>;
  BrowserData: ReturnType<typeof getDeviceData>;
  OSData: ReturnType<typeof getDeviceData>;
  Countries?: Array<{ id: string; value: number }>;
  CountryUniques?: Array<{ id: string; value: number }>;
  Pagination: Pagination;
  Regions?: Array<{ id: string; value: number }>;
  EventSummary?: {
    summary: Array<{ event: string | null; count: number; firstSeen: string | null; lastSeen: string | null }>;
    pagination: { offset: number; limit: number; total: number; hasMore: boolean };
    totalEvents: number;
    totalEventTypes: number;
    siteId: number | null;
    dateRange: { start?: string; end?: string };
  } | null;
};

export type EventTypeDistributionItem = {
  id: string;
  label: string;
  value: number;
};

export const prettifyEventName = (
  name: string,
  labelsMap?: Map<string, string>,
): string => {
  const custom = labelsMap?.get(name);
  if (custom) return custom;

  if (name.startsWith("$ac_")) {
    const parts = name.split("_");
    const text = parts[2] || "unnamed";
    const id = parts[3] || null;
    return id ? `${text}_${id}` : text;
  }

  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const getEventTypesDistribution = (
  rows: NonNullable<TableComponentProps["tableData"]>["rows"] | undefined,
  labelsMap?: Map<string, string>,
): EventTypeDistributionItem[] => {
  const safeRows = rows || [];

  const filtered = safeRows
    .filter((row) => String(row?.[0] ?? "").toLowerCase() !== "page_view")
    .map((row, index) => {
      const rawName = String(row?.[0] ?? `Step ${index + 1}`);
      const label = prettifyEventName(rawName, labelsMap);
      const value = Number(row?.[1]) || 0;
      return { id: label, label, value };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const total = filtered.reduce((sum, item) => sum + item.value, 0);
  return filtered.map((item) => ({
    ...item,
    value: total > 0 ? Math.round((item.value / total) * 100) : 0,
  }));
};


export type DeviceGeoData = ReturnType<typeof getDeviceGeoData>;
export type TopSourcesData = ReturnType<typeof getTopSourcesData>;
export type BrowserData = ReturnType<typeof getDeviceData>;
