"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useContext,
  type ReactNode,
  Suspense,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveBar } from "@nivo/bar";
import { AuthContext } from "@/app/providers/AuthProvider";
import { SiteTagInstallCard } from "@/app/components/SiteTagInstallCard";
import { useTheme } from "@/app/providers/ThemeProvider";
import { AlertBanner } from "@/app/components/ui/AlertBanner";
import { DashboardToolbar } from "@/app/components/reports/DashboardToolbar";
import type { ReportBuilderActionId } from "@/app/components/ui/ReportBuilderMenu";
import { EventSummaryTable } from "@components/charts/EventSummary";
import { ChartComponent, ChartSkeleton, CardTabs, TableComponent, getCountryFlagIcon, getBrowserTimeZone, getDateStringInTimeZone, isValidTimeZone, ScorecardSkeleton, SkeletonBlock, SpinnerIcon, HelpTooltip, DateRange, DashboardFilters, FilterModal, DashboardNotice, DatePicker, Scorecard } from "@/app/components/charts/ChartComponents";

import { useMediaQuery } from "@/app/utils/media";
import {
  type DeviceGeoData,
  type NivoBarChartData,
  type NivoLineChartData,
  type NivoPieChartData,
  type TableComponentProps,
  TopSourcesData,
  BrowserData,
  DashboardResponseData,
} from "@db/tranformReports";

import { chartColors } from "@/app/utils/chartThemes";
import { DashboardCard } from "@components/DashboardCard";
import { WorldMapCard } from "@components/WorldMapCard";
import type { EventLabelSelect } from "@db/d1/schema";
import { EventTypesFunnel } from "@/app/components/charts/EventFunnel";

// Props for the main DashboardPage (now empty as data is fetched internally)
export interface DashboardPageProps {
  PageViewsData?: NivoLineChartData;
  ReferrersData?: NivoPieChartData;
  EventTypesData?: TableComponentProps["tableData"];
  DeviceGeoData?: DeviceGeoData;
  TopPagesData?: NivoBarChartData;
  TopSourcesData?: TopSourcesData;
  BrowserData?: BrowserData;
  EventSummary?: DashboardResponseData["EventSummary"];
  DateRange?: {
    auto: "7 days";
  };
  activeReportBuilderItemId?: ReportBuilderActionId;
}
const getBrowserIcon = (name: string | null | undefined) => {
  const value = typeof name === "string" ? name.toLowerCase() : "";

  const iconMap = [
    { match: ["edge"], label: "E", classes: "bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/40" },
    { match: ["opera"], label: "O", classes: "bg-red-500/15 text-red-300 ring-1 ring-red-400/40" },
    { match: ["firefox", "fxios"], label: "F", classes: "bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/40" },
    { match: ["safari"], label: "S", classes: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/40" },
    { match: ["chrome", "chromium", "crios"], label: "C", classes: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40" },
    { match: ["brave"], label: "B", classes: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/40" },
    { match: ["ie", "internet explorer"], label: "IE", classes: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/40" },
  ];

  const matched = iconMap.find(({ match }) => match.some((token) => value.includes(token)));

  if (!matched) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${matched.classes}`}
    >
      {matched.label}
    </span>
  );
};

const getBrowserLogo = (name: string | null | undefined) => {
  const value = typeof name === "string" ? name.toLowerCase() : "";

  if (value.includes("edge")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-5 w-5">
        <circle cx="32" cy="32" r="30" fill="#0B5CAB" />
        <path
          d="M50 32c0-10-8-18-18-18-7 0-13 4-16 10 3-2 6-3 10-3 9 0 16 6 16 13 0 3-1 6-3 8 7-3 11-9 11-10z"
          fill="#22D3EE"
        />
        <path
          d="M14 34c1 12 11 20 22 20 9 0 16-5 20-12-3 1-6 2-10 2-10 0-18-6-18-14 0-4 2-7 4-9-9 1-16 7-18 13z"
          fill="#38BDF8"
        />
      </svg>
    );
  }

  if (value.includes("opera")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-5 w-5">
        <circle cx="32" cy="32" r="26" fill="none" stroke="#FF1B2D" strokeWidth="10" />
        <circle cx="32" cy="32" r="14" fill="none" stroke="#FF6B6B" strokeWidth="4" opacity="0.4" />
      </svg>
    );
  }

  if (value.includes("firefox") || value.includes("fxios")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-5 w-5">
        <circle cx="32" cy="32" r="30" fill="#FF7139" />
        <path
          d="M46 18c-6 1-10 5-12 10 6 2 10 7 10 13 0 8-6 14-14 14-6 0-12-3-15-8 2 8 10 15 20 15 11 0 20-9 20-20 0-9-6-18-9-24z"
          fill="#7C3AED"
        />
        <path
          d="M24 24c-2 4-1 8 2 11-4 1-6 4-6 7 0 6 6 10 12 8-4-1-7-4-7-8 0-4 3-7 7-8-4-2-7-5-8-10z"
          fill="#F97316"
        />
      </svg>
    );
  }

  if (value.includes("safari")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-5 w-5">
        <circle cx="32" cy="32" r="30" fill="#0EA5E9" />
        <circle cx="32" cy="32" r="22" fill="none" stroke="#E0F2FE" strokeWidth="3" />
        <path d="M32 14l6 18-6-3-6 3 6-18z" fill="#F87171" />
        <path d="M32 50l-6-18 6 3 6-3-6 18z" fill="#F8FAFC" />
        <circle cx="32" cy="32" r="3" fill="#F8FAFC" />
      </svg>
    );
  }

  if (value.includes("chrome") || value.includes("chromium") || value.includes("crios")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-5 w-5">
        <path d="M32 32L32 2A30 30 0 0 1 58 47Z" fill="#DB4437" />
        <path d="M32 32L58 47A30 30 0 0 1 6 47Z" fill="#0F9D58" />
        <path d="M32 32L6 47A30 30 0 0 1 32 2Z" fill="#F4B400" />
        <circle cx="32" cy="32" r="12" fill="#4285F4" />
        <circle cx="32" cy="32" r="5" fill="#E6F0FF" />
      </svg>
    );
  }

  if (value.includes("brave")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-5 w-5">
        <path
          d="M16 10h32l6 10-4 24-18 10-18-10-4-24 6-10z"
          fill="#F97316"
        />
        <path d="M22 20h20l4 6-3 16-11 6-11-6-3-16 4-6z" fill="#FDBA74" />
      </svg>
    );
  }

  return null;
};

const getOsIcon = (name: string | null | undefined) => {
  const value = typeof name === "string" ? name.toLowerCase() : "";

  const iconMap = [
    { match: ["windows"], label: "W", classes: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/40" },
    { match: ["macos", "mac os", "os x", "mac"], label: "M", classes: "bg-slate-500/20 text-slate-200 ring-1 ring-slate-400/40" },
    { match: ["ios", "ipados"], label: "i", classes: "bg-slate-500/20 text-slate-200 ring-1 ring-slate-400/40" },
    { match: ["android"], label: "A", classes: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40" },
    { match: ["ubuntu"], label: "U", classes: "bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/40" },
    { match: ["linux"], label: "L", classes: "bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-400/40" },
    { match: ["chrome os", "chromebook"], label: "C", classes: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/40" },
  ];

  const matched = iconMap.find(({ match }) => match.some((token) => value.includes(token)));

  if (!matched) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${matched.classes}`}
    >
      {matched.label}
    </span>
  );
};

const getOsLogo = (name: string | null | undefined) => {
  const value = typeof name === "string" ? name.toLowerCase() : "";

  if (value.includes("windows")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-5 w-5">
        <rect x="6" y="8" width="24" height="22" fill="#00A4EF" />
        <rect x="34" y="8" width="24" height="22" fill="#00A4EF" />
        <rect x="6" y="34" width="24" height="22" fill="#00A4EF" />
        <rect x="34" y="34" width="24" height="22" fill="#00A4EF" />
      </svg>
    );
  }

  if (value.includes("ios") || value.includes("ipados") || value.includes("macos") || value.includes("mac os") || value.includes("os x")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-5 w-5">
        <path
          d="M32 20c-4-5-11-4-14 1-3 6-1 15 3 21 3 5 7 9 11 9 3 0 4-2 7-2 3 0 4 2 7 2 4 0 8-4 11-9 4-7 6-15 3-21-3-5-10-6-14-1-2 2-4 3-7 3-3 0-5-1-7-3z"
          fill="#E5E7EB"
        />
        <path
          d="M39 10c2-3 5-5 9-6-1 4-3 7-6 9-3 2-6 3-9 2 0-2 3-4 6-5z"
          fill="#E5E7EB"
        />
      </svg>
    );
  }

  if (value.includes("android")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-5 w-5">
        <rect x="14" y="20" width="36" height="26" rx="8" fill="#3DDC84" />
        <circle cx="26" cy="32" r="2" fill="#0F172A" />
        <circle cx="38" cy="32" r="2" fill="#0F172A" />
        <line x1="22" y1="20" x2="16" y2="12" stroke="#3DDC84" strokeWidth="4" strokeLinecap="round" />
        <line x1="42" y1="20" x2="48" y2="12" stroke="#3DDC84" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (value.includes("ubuntu")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-5 w-5">
        <circle cx="32" cy="32" r="22" fill="none" stroke="#E95420" strokeWidth="6" />
        <circle cx="32" cy="10" r="4" fill="#E95420" />
        <circle cx="12" cy="42" r="4" fill="#E95420" />
        <circle cx="52" cy="42" r="4" fill="#E95420" />
      </svg>
    );
  }

  if (value.includes("linux")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-5 w-5">
        <circle cx="32" cy="18" r="8" fill="#111827" />
        <ellipse cx="32" cy="40" rx="14" ry="18" fill="#111827" />
        <ellipse cx="32" cy="42" rx="8" ry="12" fill="#F8FAFC" />
        <circle cx="28" cy="18" r="2" fill="#F8FAFC" />
        <circle cx="36" cy="18" r="2" fill="#F8FAFC" />
        <path d="M32 22l4 4h-8l4-4z" fill="#F59E0B" />
      </svg>
    );
  }

  if (value.includes("chrome os") || value.includes("chromebook")) {
    return (
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-5 w-5">
        <path d="M32 32L32 2A30 30 0 0 1 58 47Z" fill="#DB4437" />
        <path d="M32 32L58 47A30 30 0 0 1 6 47Z" fill="#0F9D58" />
        <path d="M32 32L6 47A30 30 0 0 1 32 2Z" fill="#F4B400" />
        <circle cx="32" cy="32" r="12" fill="#4285F4" />
        <circle cx="32" cy="32" r="5" fill="#E6F0FF" />
      </svg>
    );
  }

  return null;
};

const getOsDotClass = (name: string | null | undefined) => {
  const value = typeof name === "string" ? name.toLowerCase() : "";

  if (value.includes("windows")) return "bg-blue-600";
  if (value.includes("macos") || value.includes("mac os") || value.includes("os x")) return "bg-gray-500";
  if (value.includes("ios") || value.includes("ipados")) return "bg-slate-400";
  if (value.includes("ubuntu")) return "bg-orange-500";
  if (value.includes("linux")) return "bg-yellow-500";
  if (value.includes("android")) return "bg-green-600";
  if (value.includes("chrome os") || value.includes("chromebook")) return "bg-sky-500";

  return "bg-green-600";
};

// --- DashboardPage (fetches its own data) ---
export function DashboardPage(props: DashboardPageProps) {
  const isSmallScreen = useMediaQuery("(max-width: 640px)");
  const {
    PageViewsData,
    EventTypesData,
    DeviceGeoData,
    ReferrersData,
    EventSummary,
    activeReportBuilderItemId = "create-report",
  } = props;

  const { data: session, isPending: isSessionLoading, current_site } = useContext(
    AuthContext,
  ) || { data: null, isPending: true };

  const browserTimezone = useMemo(() => getBrowserTimeZone(), []);
  const savedTimezone = session?.timezone;
  const effectiveTimezone =
    isValidTimeZone(savedTimezone) ? savedTimezone : browserTimezone;

  const { theme } = useTheme();

  const currentSiteTag =
    !isSessionLoading && session && current_site && session.userSites
      ? session.userSites.find((site) => site.site_id === current_site.id)
      : null;

  // const [current_site, setCurrentSite] = useState<{ name: string, id: number } | undefined>();
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: {
      start: "",
      end: "",
      preset: "Today",
    },
    deviceType: undefined,
    country: undefined,
    city: undefined,
    region: undefined,
    source: undefined,
    pageUrl: undefined,
    eventName: undefined,
    siteId: undefined,
  });

  const [isClientReady, setIsClientReady] = useState(false);
  const hasInitializedDateRange = useRef(false);

  useEffect(() => {
    if (isSessionLoading || hasInitializedDateRange.current) return;

    const today = getDateStringInTimeZone(new Date(), effectiveTimezone);

    setFilters((prevFilters) => ({
      ...prevFilters,
      dateRange: {
        start: today,
        end: today,
        preset: "Today",
      },
    }));
    hasInitializedDateRange.current = true;
    setIsClientReady(true);
  }, [effectiveTimezone, isSessionLoading]);

  useEffect(() => {
    const nextSiteId =
      current_site?.id?.toString() ?? session?.userSites?.[0]?.site_id?.toString();

    if (!nextSiteId) return;

    setFilters((prevFilters) => ({
      ...prevFilters,
      siteId: nextSiteId,
    }));
  }, [current_site?.id, session?.userSites]);

  // UI state for modals
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const [notice, setNotice] = useState<DashboardNotice | null>(null);

  useEffect(() => {
    if (!notice) return;

    const handle = window.setTimeout(() => {
      setNotice(null);
    }, 5000);

    return () => {
      window.clearTimeout(handle);
    };
  }, [notice]);

  const notify = useCallback((nextNotice: DashboardNotice) => {
    setNotice(nextNotice);
  }, []);

  const getRequestIdFromErrorMessage = (message: string): string | null => {
    const match = message.match(/requestId\s*[:=]\s*([a-f0-9-]{8,})/i);
    return match ? match[1] : null;
  };

  const getFriendlyDashboardErrorMessage = (error: unknown): string => {
    if (!(error instanceof Error)) {
      return "We couldn’t load the dashboard. Please try again.";
    }

    const message = error.message.trim();

    if (message.toLowerCase().includes("no site selected")) {
      return "Select a site to load dashboard metrics.";
    }

    if (message.toLowerCase().includes("failed to fetch")) {
      return "Network error while loading metrics. Check your connection and try again.";
    }

    if (message.toLowerCase().includes("site not found")) {
      return "This site isn’t available for your account. Try selecting a different site.";
    }

    if (message.toLowerCase().includes("no data found")) {
      return "No matching events for the selected filters.";
    }

    return message || "We couldn’t load the dashboard. Please try again.";
  };

  // React Query for dashboard data fetching
  const {
    data: apiData,
    error: queryError,
    isLoading,
    isFetching,
    refetch: refetchData,
  } = useQuery({
    queryKey: [
      "dashboardData",
      current_site?.id,
      filters.dateRange,
      filters.deviceType,
      filters.country,
      filters.city,
      filters.region,
      filters.source,
      filters.pageUrl,
      filters.eventName,
      effectiveTimezone,
    ],
    queryFn: async () => {
      if (!current_site?.id) {
        throw new Error("No site selected");
      }

      try {
        const response = await fetch("/api/dashboard/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site_id: current_site.id,
            date_start: filters.dateRange.start,
            date_end: filters.dateRange.end,
            device_type: filters.deviceType,
            country: filters.country,
            city: filters.city,
            region: filters.region,
            source: filters.source,
            page_url: filters.pageUrl,
            event_name: filters.eventName,
            timezone: effectiveTimezone,
          }),
        });

        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (!response.ok) {
          const messageFromApi =
            typeof payload === "object" && payload !== null && "error" in payload
              ? String((payload as { error: unknown }).error)
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
            `Failed to load dashboard data (HTTP ${response.status})`;

          throw new Error(
            requestIdFromApi ? `${baseMessage} (requestId: ${requestIdFromApi})` : baseMessage,
          );
        }

        return payload as DashboardResponseData;
      } catch (error) {
        console.error("Dashboard data fetch error:", error);
        throw error;
      }
    },
    enabled: isClientReady && !isSessionLoading && !!current_site?.id && !!filters.dateRange.start && !!filters.dateRange.end,
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  const labelsQuery = useQuery<EventLabelSelect[], Error>({
    queryKey: ["event-labels", current_site?.id],
    queryFn: async () => {
      if (!current_site?.id) return [];
      const response = await fetch(`/api/event-labels?site_id=${current_site.id}`);
      if (!response.ok) throw new Error("Failed to fetch event labels");
      return response.json();
    },
    enabled: Boolean(current_site?.id),
    staleTime: 5 * 60 * 1000,
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

  const dashboardData = useMemo(() => ({
    topPagesData: apiData?.TopPagesData || props.TopPagesData,
    topSourcesData: apiData?.TopSourcesData || props.TopSourcesData,
    browserData: apiData?.BrowserData || props.BrowserData,
    osData: apiData?.OSData || [],
    pageViewsData: apiData?.PageViewsData || PageViewsData,
    referrersData: apiData?.ReferrersData || ReferrersData,
    eventTypesData: apiData?.EventTypesData || EventTypesData,
    deviceGeoData: apiData?.DeviceGeoData || DeviceGeoData,
    eventSummary: apiData?.EventSummary || EventSummary,
    regions: apiData?.Regions || [],
  }), [apiData, props.TopPagesData, props.TopSourcesData, props.BrowserData, PageViewsData, ReferrersData, EventTypesData, DeviceGeoData, EventSummary]);

  // Tab state management
  const [topSourcesTab, setTopSourcesTab] = useState<"Sources" | "Referrers">(
    "Sources",
  );

  const [locationsTab, setLocationsTab] = useState<"Countries" | "Cities">(
    "Countries",
  );
  const [devicesTab, setDevicesTab] = useState<"Browser" | "OS">("Browser");

  const aggregatedCountries = useMemo(() => {
    const countryRows = apiData?.Countries;
    if (countryRows && countryRows.length > 0) {
      return countryRows
        .filter((row) => typeof row?.id === "string" && row.id.length > 0)
        .map((row) => [row.id, row.value] as [string, number]);
    }

    const geoRows = dashboardData.deviceGeoData?.geoData?.rows;
    if (!geoRows || geoRows.length === 0) return [];
    const countryMap = new Map<string, number>();
    geoRows.forEach((row) => {
      const [country, , count] = row as [string, string, number];
      countryMap.set(country, (countryMap.get(country) || 0) + count);
    });
    return Array.from(countryMap.entries()).sort((a, b) => b[1] - a[1]);
  }, [apiData?.Countries, dashboardData.deviceGeoData?.geoData?.rows]);

  const mapCountries = useMemo(() => {
    const uniqueRows = apiData?.CountryUniques;
    if (uniqueRows && uniqueRows.length > 0) {
      return uniqueRows
        .filter((row) => typeof row?.id === "string" && row.id.length > 0)
        .map((row) => [row.id, row.value] as [string, number]);
    }

    return aggregatedCountries;
  }, [apiData?.CountryUniques, aggregatedCountries]);

  const deviceTypeFilterOptions = useMemo(
    () => (dashboardData.deviceGeoData?.deviceTypes?.data || []).map((d: { id: string }) => d.id).filter(Boolean),
    [dashboardData.deviceGeoData?.deviceTypes?.data],
  );

  const countryFilterOptions = useMemo(
    () => aggregatedCountries.map(([country]) => country),
    [aggregatedCountries],
  );

  const sourceFilterOptions = useMemo(
    () => (dashboardData.topSourcesData || []).map((s: any) => s.name),
    [dashboardData.topSourcesData],
  );

  const pageUrlFilterOptions = useMemo(
    () => {
      const topPages = dashboardData.topPagesData;
      if (!topPages?.data || topPages.data.length === 0) return [];
      const indexBy = topPages.indexBy || "page";
      return topPages.data
        .map((row) => String((row as Record<string, unknown>)[indexBy] ?? ""))
        .filter(Boolean);
    },
    [dashboardData.topPagesData],
  );

  const cityFilterOptions = useMemo(() => {
    const geoRows = dashboardData.deviceGeoData?.geoData?.rows;
    if (!geoRows || geoRows.length === 0) return [];
    const citySet = new Set<string>();
    geoRows.forEach((row) => {
      const city = (row as [string, string, number])[1];
      if (city) citySet.add(city);
    });
    return Array.from(citySet).sort();
  }, [dashboardData.deviceGeoData?.geoData?.rows]);

  const regionFilterOptions = useMemo(
    () => (dashboardData.regions || []).map((r: { id: string }) => r.id),
    [dashboardData.regions],
  );

  const eventNameFilterOptions = useMemo(() => {
    const rows = dashboardData.eventTypesData?.rows;
    if (!rows || rows.length === 0) return [];
    return rows.map((row) => String(row[0])).filter(Boolean);
  }, [dashboardData.eventTypesData?.rows]);

  const handleFiltersChange = useCallback((newFilters: DashboardFilters) => {
    setFilters(newFilters);

    const hasAnyFilter =
      !!newFilters.deviceType || !!newFilters.country || !!newFilters.city || !!newFilters.region || !!newFilters.source || !!newFilters.pageUrl || !!newFilters.eventName;
    notify({
      type: "info",
      message: hasAnyFilter
        ? "Filters updated."
        : "All filters cleared.",
    });
  }, [notify]);

  // Handle date range changes
  // const handleDateRangeChange = useCallback((newDateRange: DateRange) => {
  //   const newFilters = { ...filters, dateRange: newDateRange };
  //   handleFiltersChange(newFilters);
  // }, [filters, handleFiltersChange]);

  async function handleDateRangeChange(newDateRange: DateRange) {
    setFilters((prevFilters) => ({
      ...prevFilters,
      dateRange: newDateRange,
    }));

    notify({
      type: "info",
      message: "Date range updated.",
    });
  }


  // Format date range display
  const getDateRangeDisplay = () => {
    if (!filters.dateRange.start || !filters.dateRange.end) {
      return "Loading dates...";
    }
    if (filters.dateRange.preset) {
      return filters.dateRange.preset;
    }
    return `${filters.dateRange.start} to ${filters.dateRange.end}`;
  };

  const toolbarControls: ReactNode = (
    <>
      <button
        type="button"
        onClick={() => setIsFilterModalOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isFilterModalOpen}
        className="bg-(--theme-bg-secondary) hover:bg-(--theme-bg-tertiary) text-(--theme-text-primary) font-medium py-1.5 px-3 sm:py-2 sm:px-4 text-sm rounded-md border border-(--theme-border-primary) transition-colors focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary)"
      >
        Filter
      </button>
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
          aria-haspopup="dialog"
          aria-expanded={isDatePickerOpen}
          className="bg-(--theme-bg-secondary) hover:bg-(--theme-bg-tertiary) text-(--theme-text-primary) py-1.5 px-3 sm:py-2 sm:px-4 text-sm rounded-md border border-(--theme-border-primary) cursor-pointer transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary)"
        >
          <span className="truncate max-w-32 sm:max-w-56">
            {getDateRangeDisplay()}
          </span>
          <svg
            aria-hidden="true"
            focusable="false"
            className="w-4 h-4 shrink-0"
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
        <div className="hidden sm:flex">
          <HelpTooltip text="Change the reporting period. Presets update immediately; custom dates apply when the picker closes." />
        </div>
        <DatePicker
          dateRange={filters.dateRange}
          onDateRangeChange={handleDateRangeChange}
          isOpen={isDatePickerOpen}
          onToggle={() => setIsDatePickerOpen(!isDatePickerOpen)}
          timezone={effectiveTimezone}
        />
      </div>
    </>
  );

  const toolbarFooter: ReactNode = (
    <>
      {(() => {
        const chips: Array<{ label: string; key: keyof DashboardFilters }> = [];
        if (filters.deviceType) chips.push({ label: `Device: ${filters.deviceType}`, key: "deviceType" });
        if (filters.country) chips.push({ label: `Country: ${filters.country}`, key: "country" });
        if (filters.region) chips.push({ label: `Region: ${filters.region}`, key: "region" });
        if (filters.city) chips.push({ label: `City: ${filters.city}`, key: "city" });
        if (filters.source) chips.push({ label: `Source: ${filters.source}`, key: "source" });
        if (filters.pageUrl) chips.push({ label: `Page: ${filters.pageUrl}`, key: "pageUrl" });
        if (filters.eventName) chips.push({ label: `Event: ${filters.eventName}`, key: "eventName" });
        if (chips.length === 0) return null;
        return (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {chips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 rounded-full bg-(--theme-bg-tertiary) border border-(--theme-border-primary) px-2.5 py-0.5 text-xs text-(--theme-text-primary)"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, [chip.key]: undefined }))}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-(--theme-bg-secondary) transition-colors focus:outline-none focus:ring-1 focus:ring-(--theme-border-secondary)"
                  aria-label={`Remove ${chip.label} filter`}
                >
                  <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setFilters((prev) => ({
                dateRange: prev.dateRange,
                siteId: prev.siteId,
              }))}
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs text-(--theme-text-secondary) hover:text-(--theme-text-primary) transition-colors focus:outline-none focus:ring-1 focus:ring-(--theme-border-secondary)"
            >
              Clear all
            </button>
          </div>
        );
      })()}

      {isFetching && !isLoading && (
        <div className="flex items-center gap-2 mt-2 text-xs text-(--theme-text-secondary)">
          <SpinnerIcon className="w-3 h-3 animate-spin" />
          <span>Updating dashboard...</span>
        </div>
      )}
    </>
  );

  if (isSessionLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <span className="text-(--theme-text-secondary)">
              Loading session...
            </span>
          </div>
        </main>
      </div>
    );
  }

  if (!current_site?.id) {
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <span className="text-(--theme-text-secondary)">
              Select a site to view the dashboard.
            </span>
          </div>
        </main>
      </div>
    );
  }


  if (queryError) {
    const message = getFriendlyDashboardErrorMessage(queryError);
    const requestId =
      queryError instanceof Error
        ? getRequestIdFromErrorMessage(queryError.message)
        : null;

    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <div className="max-w-md text-center">
              <p className="text-(--theme-text-primary) font-semibold mb-2">
                Unable to load dashboard
              </p>
              <p className="text-(--theme-text-secondary) mb-4">
                {message}
              </p>
              {requestId && (
                <p className="text-xs text-(--theme-text-secondary) mb-4">
                  Request ID: <span className="font-mono">{requestId}</span>
                </p>
              )}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => refetchData()}
                  className="bg-(--theme-bg-secondary) hover:bg-(--theme-bg-tertiary) text-(--theme-text-primary) font-medium py-2 px-4 rounded-md border border-(--theme-border-primary) transition-colors"
                >
                  Try again
                </button>
                <a
                  href="/dashboard/settings"
                  className="bg-(--theme-button-bg) hover:bg-(--theme-button-hover) text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Check Settings
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!isClientReady) {
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <span className="text-(--theme-text-secondary)">
              Preparing dashboard...
            </span>
          </div>
        </main>
      </div>
    );
  }

  if (!apiData && !isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <div className="max-w-md text-center">
              <p className="text-(--theme-text-primary) font-semibold mb-2">
                No dashboard data available
              </p>
              <p className="text-(--theme-text-secondary) mb-4">
                We couldn’t find any metrics to display for this site yet.
              </p>
              <a
                href="/dashboard/settings"
                className="bg-(--theme-button-bg) hover:bg-(--theme-button-hover) text-white font-medium py-2 px-4 rounded-md transition-colors inline-flex focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary)"
              >
                Go to Settings
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Navigation Bar */}

      <Suspense fallback={<></>}>
        {/* Main Content Area */}
        <main className="flex-1">
          <DashboardToolbar
            activeReportBuilderItemId={activeReportBuilderItemId}
            controls={toolbarControls}
            footer={toolbarFooter}
          />
          <div className="p-4 sm:p-6 lg:p-8">
            {isLoading || !apiData ? (
              <>
                <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <ScorecardSkeleton key={index} />
                  ))}
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-6 text-(--theme-text-primary)">
                    Key Metrics Visualized
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div className="lg:col-span-2 bg-(--theme-card-bg) border border-(--theme-card-border) rounded-lg p-6">
                      <SkeletonBlock className="h-5 w-40 mb-4" />
                      <ChartSkeleton height="350px" />
                    </div>
                    <div className="bg-(--theme-card-bg) border border-(--theme-card-border) rounded-lg p-6">
                      <SkeletonBlock className="h-5 w-32 mb-4" />
                      <ChartSkeleton height="350px" />
                    </div>
                    <div className="bg-(--theme-card-bg) border border-(--theme-card-border) rounded-lg p-6">
                      <SkeletonBlock className="h-5 w-32 mb-4" />
                      <ChartSkeleton height="350px" />
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="bg-(--theme-card-bg) border border-(--theme-card-border) rounded-lg p-6"
                    >
                      <SkeletonBlock className="h-5 w-40 mb-4" />
                      <div className="space-y-3">
                        {Array.from({ length: 5 }).map((__, rowIndex) => (
                          <SkeletonBlock key={rowIndex} className="h-4 w-full" />
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              </>
            ) : (apiData && apiData.noSiteRecordsExist) ? (
              <div className="flex flex-col items-center justify-center gap-6 w-full">
                <div className="text-center w-full max-w-4xl px-4">
                  <h2 className="text-2xl font-bold mb-2 text-(--theme-text-primary)">
                    No data yet
                  </h2>
                  <p className="text-(--theme-text-secondary) mb-2">
                    We haven’t collected any events for this site.
                  </p>
                  <p className="text-xs text-(--theme-text-secondary) mb-6">
                    Add the Lytx site tag, then refresh this page once traffic starts flowing.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <a
                      href="/dashboard/settings"
                      className="inline-flex items-center px-4 py-2 bg-(--theme-input-bg) text-(--theme-text-primary) border border-(--theme-input-border) rounded hover:bg-(--theme-bg-secondary) transition-colors focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary)"
                    >
                      Open settings
                    </a>
                  </div>
                </div>
                {currentSiteTag ? (
                  <div id="site-tag-install" className="w-full max-w-5xl mx-auto">
                    <SiteTagInstallCard site={currentSiteTag} />
                  </div>
                ) : null}
              </div>
            ) : (apiData && apiData.Pagination?.total === 0) ? (
              <div className="flex flex-col items-center justify-center gap-4 w-full">
                <div className="text-center w-full max-w-4xl px-4">
                  <h2 className="text-2xl font-bold mb-2 text-(--theme-text-primary)">
                    No data for this date range
                  </h2>
                  <p className="text-(--theme-text-secondary) mb-2">
                    Try expanding the date filter to see activity.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* KPI Metrics Row */}
                <div className="relative mb-8">
                  <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    {apiData
                      ? apiData.ScoreCards.map((scoreCard) => (
                        <Scorecard
                          key={scoreCard.title}
                          title={scoreCard.title}
                          value={scoreCard.value.toString()}
                          change={scoreCard.change.toString()}
                          changeType={scoreCard.changeType}
                          changeLabel={scoreCard.changeLabel}
                        />
                      ))
                      : ""}
                  </section>
                </div>



                {/* Main Visualization Area */}
                {/* This section itself is already styled as a card: bg-white p-4 shadow rounded-lg */}
                {/* So, ChartComponents can be direct children or wrapped in a grid for layout */}
                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-6 text-(--theme-text-primary)">
                    Key Metrics Visualized
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Page Views Chart - takes full width on small, half on large */}
                    <div className="lg:col-span-2">
                      <ChartComponent
                        chartId="pageViewsChart"
                        chartData={dashboardData.pageViewsData}
                        isLoading={isFetching}
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
                      isLoading={isFetching}
                      onItemClick={(id) => setFilters((prev) => ({ ...prev, source: id }))}
                    />
                    {/* Device Types Chart - part of deviceGeoData */}
                    {dashboardData.deviceGeoData && (
                      <ChartComponent
                        chartId="deviceTypesChart"
                        chartData={dashboardData.deviceGeoData.deviceTypes}
                        title="Device Types"
                        type="pie"
                        isLoading={isFetching}
                        onItemClick={(id) => setFilters((prev) => ({ ...prev, deviceType: id }))}
                      />
                    )}
                  </div>
                </section>

                {/* Detailed Information Grid (2x2) */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* Top Sources Card (Top-Left) */}
                  <DashboardCard title="Top Sources" titleAs="h3">
                    <CardTabs
                      tabs={["Sources", "Referrers"]}
                      activeTab={topSourcesTab}
                      onTabClick={(tab) =>
                        setTopSourcesTab(tab as "Sources" | "Referrers")
                      }
                    >
                      <ul className="space-y-3">
                        {topSourcesTab === "Sources"
                          ? (dashboardData.topSourcesData || []).map((source: any, index: number) => (
                            <li
                              key={source.name}
                              className="flex items-center justify-between py-2 border-b border-(--theme-border-primary) last:border-b-0 cursor-pointer hover:bg-(--theme-bg-secondary) rounded px-1 -mx-1 transition-colors"
                              onClick={() => setFilters((prev) => ({ ...prev, source: source.name }))}
                            >
                              <div className="flex items-center">
                                <span
                                  className="w-4 h-4 rounded-full mr-3"
                                  style={{ backgroundColor: chartColors.mixed[index % chartColors.mixed.length] }}
                                />
                                <span className="text-sm text-(--theme-text-primary)">
                                  {source.name}
                                </span>
                              </div>
                              <span className="text-sm text-(--theme-text-primary) font-medium">
                                {source.visitors.toLocaleString()}
                              </span>
                            </li>
                          ))
                          : (dashboardData.referrersData?.data || []).map(
                            (referrer: any, index: number) => (
                              <li
                                key={referrer.id}
                                className="flex items-center justify-between py-2 border-b border-(--theme-border-primary) last:border-b-0 cursor-pointer hover:bg-(--theme-bg-secondary) rounded px-1 -mx-1 transition-colors"
                                onClick={() => setFilters((prev) => ({ ...prev, source: referrer.id }))}
                              >
                                <div className="flex items-center">
                                  <span
                                    className="w-4 h-4 rounded-full mr-3"
                                    style={{ backgroundColor: chartColors.mixed[index % chartColors.mixed.length] }}
                                  />
                                  <span className="text-sm text-(--theme-text-primary)">
                                    {referrer.id}
                                  </span>
                                </div>
                                <span className="text-sm text-(--theme-text-primary) font-medium">
                                  {referrer.value.toLocaleString()}
                                </span>
                              </li>
                            ),
                          )}
                      </ul>
                    </CardTabs>
                  </DashboardCard>

                  {/* Top Pages Card (Top-Right) */}
                  <DashboardCard title="Top Pages" titleAs="h3">
                    <div style={{ height: "250px", cursor: "pointer" }}>
                      <ResponsiveBar
                        data={dashboardData.topPagesData?.data || []}
                        keys={dashboardData.topPagesData?.keys || []}
                        indexBy={dashboardData.topPagesData?.indexBy || "page"}
                        layout="horizontal"
                        margin={
                          isSmallScreen
                            ? { top: 10, right: 10, bottom: 20, left: 80 }
                            : { top: 10, right: 10, bottom: 20, left: 120 }
                        }
                        padding={0.3}
                        colors={["#3B82F6"]}
                        borderColor="#1D4ED8"
                        borderWidth={2}
                        axisTop={null}
                        axisRight={null}
                        axisBottom={null}
                        axisLeft={{
                          tickSize: 0,
                          tickPadding: 5,
                          tickRotation: 0,
                          legend: "",
                          format: (value) => {
                            const maxLen = isSmallScreen ? 10 : 15;
                            return String(value).length > maxLen
                              ? String(value).substring(0, maxLen - 1) + "…"
                              : String(value);
                          },
                        }}
                        enableGridX={true}
                        enableGridY={false}
                        gridXValues={5}
                        enableLabel={false}
                        isInteractive={true}
                        onClick={(bar) => setFilters((prev) => ({ ...prev, pageUrl: String(bar.indexValue) }))}
                        tooltip={({ id, value, color }) => (
                          <div
                            style={{
                              padding: "6px 10px",
                              background: "#1F2937",
                              color: "#F9FAFB",
                              border: `1px solid ${color}`,
                              borderRadius: "3px",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            <strong>{id}</strong>: {value.toLocaleString()}
                          </div>
                        )}
                        theme={{
                          axis: {
                            ticks: {
                              text: {
                                fill: "var(--theme-text-secondary)",
                                fontSize: isSmallScreen ? 10 : 11,
                                fontWeight: 600,
                              },
                            },
                          },
                          grid: {
                            line: {
                              stroke: "var(--theme-border-primary)",
                              strokeDasharray: "2 2",
                            },
                          },
                        }}
                      />
                    </div>
                  </DashboardCard>

                  {/* Locations Card (Bottom-Left) */}
                  <DashboardCard title="Locations" titleAs="h3">
                    <CardTabs
                      tabs={["Countries", "Cities"]}
                      activeTab={locationsTab}
                      onTabClick={(tab) =>
                        setLocationsTab(tab as "Countries" | "Cities")
                      }
                    >
                      <div style={{ height: "300px" }}>
                        {locationsTab === "Countries" ? (
                          aggregatedCountries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                              <p className="text-(--theme-text-secondary)">
                                No location data available
                              </p>
                              <p className="text-xs text-(--theme-text-secondary) mt-2">
                                Try a longer date range or clear filters.
                              </p>
                            </div>
                          ) : (
                            <ul className="space-y-3 pt-4 overflow-y-auto overflow-x-hidden scrollbar-none max-h-65">
                              {aggregatedCountries.map(([country, count]) => (
                                <li
                                  key={country}
                                  className="flex items-center justify-between py-2 border-b border-(--theme-border-primary) last:border-b-0 cursor-pointer hover:bg-(--theme-bg-secondary) rounded px-1 -mx-1 transition-colors"
                                  onClick={() => setFilters((prev) => ({ ...prev, country }))}
                                >
                                  <div className="flex items-center">
                                    <span className="mr-3 inline-flex h-4 w-6 items-center justify-center">
                                      {getCountryFlagIcon(country) ?? (
                                        <span className="h-4 w-4 rounded-full bg-blue-500" />
                                      )}
                                    </span>
                                    <span className="text-sm text-(--theme-text-primary)">
                                      {country}
                                    </span>
                                  </div>
                                  <span className="text-sm text-(--theme-text-primary) font-medium">
                                    {count.toLocaleString()}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )
                        ) : (dashboardData.deviceGeoData?.geoData?.rows?.length ?? 0) === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-center">
                            <p className="text-(--theme-text-secondary)">
                              No cities data available
                            </p>
                            <p className="text-xs text-(--theme-text-secondary) mt-2">
                              Try a longer date range or clear filters.
                            </p>
                          </div>
                        ) : (
                          <ul className="space-y-3 pt-4 overflow-y-auto overflow-x-hidden scrollbar-none max-h-65">
                            {(dashboardData.deviceGeoData?.geoData?.rows || []).map((row) => {
                              const [country, city, count] = row as [string, string, number];
                              return (
                                <li
                                  key={`${city}-${country}`}
                                  className="flex items-center justify-between py-2 border-b border-(--theme-border-primary) last:border-b-0 cursor-pointer hover:bg-(--theme-bg-secondary) rounded px-1 -mx-1 transition-colors"
                                  onClick={() => setFilters((prev) => ({ ...prev, city, country }))}
                                >
                                  <div className="flex items-center">
                                    <span className="mr-3 inline-flex h-4 w-6 items-center justify-center">
                                      {getCountryFlagIcon(country) ?? (
                                        <span className="h-4 w-4 rounded-full bg-blue-500" />
                                      )}
                                    </span>
                                    <div className="flex flex-col">
                                      <span className="text-sm text-(--theme-text-primary)">
                                        {city}
                                      </span>
                                      <span className="text-xs text-(--theme-text-secondary)">
                                        {country}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-sm text-(--theme-text-primary) font-medium">
                                    {typeof count === 'number' ? count.toLocaleString() : count}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </CardTabs>
                  </DashboardCard>

                  {/* Devices Card (Bottom-Right) */}
                  <DashboardCard title="Devices" titleAs="h3">
                    <CardTabs
                      tabs={["Browser", "OS"]}
                      activeTab={devicesTab}
                      onTabClick={(tab) => setDevicesTab(tab as "Browser" | "OS")}
                    >
                      <ul className="space-y-3 pt-4">
                        {(devicesTab === "Browser"
                          ? dashboardData.browserData || []
                          : dashboardData.osData || []
                        ).map((device: any) => (
                          <li
                            key={device.name}
                            className="flex items-center justify-between py-2 border-b border-(--theme-border-primary) last:border-b-0"
                          >
                            <div className="flex items-center">
                              <span className="mr-3 inline-flex h-5 w-5 items-center justify-center">
                                {devicesTab === "Browser"
                                  ? getBrowserLogo(device.name) ?? getBrowserIcon(device.name) ?? (
                                    <span className="h-4 w-4 rounded-full bg-sky-500" />
                                  )
                                  : (
                                    getOsLogo(device.name) ??
                                    getOsIcon(device.name) ?? (
                                      <span className={`h-4 w-4 rounded-full ${getOsDotClass(device.name)}`} />
                                    )
                                  )}
                              </span>
                              <span className="text-sm text-(--theme-text-primary)">
                                {device.name}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-(--theme-text-primary) font-medium">
                                {device.visitors.toLocaleString()}
                              </span>
                              {device.percentage && (
                                <span className="text-xs text-(--theme-text-secondary)">
                                  ({device.percentage})
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardTabs>
                  </DashboardCard>
                </section>

                {/* Visitor Map */}
                <section className="mb-8">
                  <WorldMapCard
                    aggregatedCountries={mapCountries}
                    isDark={theme === "dark"}
                    metricLabel="visitors"
                  />
                </section>

                {/* Events Summary */}
                <section className="mb-8">
                  <EventSummaryTable
                    data={dashboardData.eventSummary}
                    isLoading={isFetching}
                    timezone={effectiveTimezone}
                  />
                </section>

                {/* Restored Detailed Data Section */}
                <section className="relative mb-8">


                  {(() => {
                    const eventTypesTableData = dashboardData.eventTypesData;
                    if (eventTypesTableData) {
                      return (
                        <>
                          <EventTypesFunnel
                            tableId="eventTypesTable"
                            tableData={eventTypesTableData}
                            labelsMap={eventLabelsMap}
                          />
                        </>
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

              </>)}
          </div>
          {notice && (
            <div className="fixed bottom-4 right-4 z-60 w-[min(24rem,calc(100vw-2rem))]">
              <AlertBanner
                tone={notice.type}
                message={notice.message}
                onDismiss={() => setNotice(null)}
              />
            </div>
          )}
        </main>
      </Suspense>

      {/* Filter Modal */}
      <FilterModal
        filters={filters}
        onFiltersChange={handleFiltersChange}
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onNotify={notify}
        deviceTypeOptions={deviceTypeFilterOptions}
        countryOptions={countryFilterOptions}
        cityOptions={cityFilterOptions}
        regionOptions={regionFilterOptions}
        sourceOptions={sourceFilterOptions}
        pageUrlOptions={pageUrlFilterOptions}
        eventNameOptions={eventNameFilterOptions}
      />

    </div>
  );
}

export default DashboardPage;
