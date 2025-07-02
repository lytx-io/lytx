import { DasboardDataResult } from "@db/types";

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

export interface ScorecardProps {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  changeLabel: string;
}

export interface ChartComponentProps {
  chartId: string;
  chartData: NivoChartData | null | undefined;
  title: string;
  height?: string | number;
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

export function transformToChartData(data: DasboardDataResult) {
  // Group the data by date
  const dateCountMap = new Map<string, number>();
  const eventCountMap = new Map<string, number>();
  const refererCountMap = new Map<string, number>();
  const debvCountMap = new Map<string, number>();
  const topPagesMap = new Map<string, number>();
  const browserMap = new Map<string, number>();

  const cityMap = new Map<string, { count: number; country: string }>();

  // Array<{ id: string, value: number }

  //TODO:Fix types here
  data.forEach((item) => {
    const currentCount = eventCountMap.get(item.event!) || 0;
    eventCountMap.set(item.event!, currentCount + 1);
    const newCity = { count: 0, country: item.country! };
    const currentCity = cityMap.get(item.city!);
    if (currentCity) currentCity.count++;
    cityMap.set(item.city!, currentCity ?? newCity);

    const currentReferer =
      refererCountMap.get(cleanReferer(item.referer!)) || 0;
    refererCountMap.set(cleanReferer(item.referer!), currentReferer + 1);

    const currentDebv = debvCountMap.get(item.device_type!) || 0;
    debvCountMap.set(item.device_type!, currentDebv + 1);

    const currentBrowser = browserMap.get(item.browser!) || 0;
    browserMap.set(item.browser!, currentBrowser + 1);

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
    events: Array.from(eventCountMap.entries()),
    devices: Array.from(debvCountMap.entries()),
    browsers: Array.from(browserMap.entries())
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
  const defaultData = [
    { x: "Jan 01", y: 1200 },
    { x: "Jan 02", y: 1500 },
    { x: "Jan 03", y: 1350 },
    { x: "Jan 04", y: 1600 },
    { x: "Jan 05", y: 1800 },
    { x: "Jan 06", y: 1700 },
    { x: "Jan 07", y: 1900 },
  ];
  return {
    options: { chart: { type: "line" as const } },
    data: [
      {
        id: "Page Views",
        data: data || defaultData,
      },
    ],
  };
}

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

export type DeviceGeoData = ReturnType<typeof getDeviceGeoData>;
export type TopSourcesData = ReturnType<typeof getTopSourcesData>;
export type BrowserData = ReturnType<typeof getDeviceData>;
