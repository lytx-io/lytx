"use client";

import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AuthContext } from "@/app/providers/AuthProvider";
import { DashboardToolbar } from "@/app/components/reports/DashboardToolbar";
import type { ToolbarSiteOption } from "@/app/components/reports/DashboardToolbar";
import { useDashboardToolbarControls } from "@/app/components/reports/useDashboardToolbarControls";
import { DashboardRouteFiltersContext } from "@/app/components/reports/DashboardRouteFiltersContext";
import {
  getBrowserTimeZone,
  getDateStringInTimeZone,
  isValidTimeZone,
  type DashboardFilters,
} from "@/app/components/charts/ChartComponents";
import type { ReportBuilderMenuActiveId } from "@/app/components/ui/ReportBuilderMenu";

type DashboardWorkspaceShellProps = {
  activeReportBuilderItemId: ReportBuilderMenuActiveId;
  reportBuilderEnabled: boolean;
  askAiEnabled: boolean;
  initialSites?: ToolbarSiteOption[];
  initialSiteId?: number | null;
  children: ReactNode;
};

export function DashboardWorkspaceShell({
  activeReportBuilderItemId,
  reportBuilderEnabled,
  askAiEnabled,
  initialSites = [],
  initialSiteId = null,
  children,
}: DashboardWorkspaceShellProps) {
  const { data: session, isPending: isSessionLoading, current_site } = useContext(AuthContext) || {
    data: null,
    isPending: true,
    current_site: null,
  };

  const browserTimezone = useMemo(() => getBrowserTimeZone(), []);
  const savedTimezone = session?.timezone;
  const effectiveTimezone = isValidTimeZone(savedTimezone) ? savedTimezone : browserTimezone;
  const today = useMemo(() => getDateStringInTimeZone(new Date(), effectiveTimezone), [effectiveTimezone]);

  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: {
      start: today,
      end: today,
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

  const hasInitializedDateRange = useRef(false);
  useEffect(() => {
    if (isSessionLoading || hasInitializedDateRange.current) return;

    setFilters((prev) => ({
      ...prev,
      dateRange: {
        start: today,
        end: today,
        preset: "Today",
      },
    }));

    hasInitializedDateRange.current = true;
  }, [today, isSessionLoading]);

  useEffect(() => {
    const nextSiteId =
      current_site?.id?.toString()
      ?? session?.userSites?.[0]?.site_id?.toString()
      ?? initialSiteId?.toString();
    if (!nextSiteId) return;

    setFilters((prev) => ({
      ...prev,
      siteId: nextSiteId,
    }));
  }, [current_site?.id, initialSiteId, session?.userSites]);

  const { controls, footer, modal } = useDashboardToolbarControls({
    filters,
    setFilters,
    timezone: effectiveTimezone,
  });

  return (
    <DashboardRouteFiltersContext.Provider value={{ filters, timezone: effectiveTimezone }}>
      <DashboardToolbar
        activeReportBuilderItemId={activeReportBuilderItemId}
        reportBuilderEnabled={reportBuilderEnabled}
        askAiEnabled={askAiEnabled}
        controls={controls}
        footer={footer}
        initialSites={initialSites}
        initialSiteId={initialSiteId}
      />
      <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      {modal}
    </DashboardRouteFiltersContext.Provider>
  );
}
