"use client";

import { useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SiteSelector } from "@components/SiteSelector";
import { AuthContext } from "@/app/providers/AuthProvider";
import { CurrentVisitors } from "@/app/components/charts/ChartComponents";
import {
  ReportBuilderMenu,
  type ReportBuilderMenuActiveId,
  type ReportBuilderMenuItem,
} from "@/app/components/ui/ReportBuilderMenu";
import { getDashboardReportBuilderMenuItems } from "@/app/components/reports/reportBuilderMenuItems";
import type { CustomReportRecord } from "@/app/components/reports/custom/types";

export type ToolbarSiteOption = {
  site_id: number;
  name: string;
  tag_id: string;
};

type DashboardToolbarProps = {
  activeReportBuilderItemId?: ReportBuilderMenuActiveId;
  reportBuilderEnabled?: boolean;
  askAiEnabled?: boolean;
  controls?: ReactNode;
  footer?: ReactNode;
  initialSites?: ToolbarSiteOption[];
  initialSiteId?: number | null;
  initialReportSwitcherItems?: ReportBuilderMenuItem[];
};

export function DashboardToolbar({
  activeReportBuilderItemId = "create-report",
  reportBuilderEnabled = false,
  askAiEnabled = true,
  controls,
  footer,
  initialSites = [],
  initialSiteId = null,
  initialReportSwitcherItems = [],
}: DashboardToolbarProps) {
  const { data: session, current_site } = useContext(AuthContext) || { data: null, current_site: null };
  const activeCustomReportUuid =
    activeReportBuilderItemId.startsWith("custom-report:")
      ? activeReportBuilderItemId.slice("custom-report:".length)
      : null;

  const fallbackSiteId = session?.userSites?.[0]?.site_id ?? initialSiteId ?? initialSites[0]?.site_id;
  const currentSiteId = current_site?.id ?? fallbackSiteId;

  const { data: customReportsData } = useQuery<{ reports?: CustomReportRecord[] }>({
    queryKey: ["dashboard-toolbar-custom-reports", currentSiteId],
    enabled: reportBuilderEnabled && !!currentSiteId,
    queryFn: async () => {
      const response = await fetch(`/api/reports/custom?site_id=${currentSiteId}`);
      if (!response.ok) {
        return { reports: [] };
      }
      return (await response.json()) as { reports?: CustomReportRecord[] };
    },
    staleTime: 0,
    gcTime: 0,
  });

  const reportSwitcherItems = useMemo<ReportBuilderMenuItem[]>(() => {
    const reports = customReportsData?.reports ?? [];
    if (reports.length === 0 && initialReportSwitcherItems.length > 0) {
      return initialReportSwitcherItems;
    }

    return reports.slice(0, 10).map((report) => ({
      id: `custom-report:${report.uuid}`,
      label: report.name || "Untitled custom report",
      href: `/dashboard/reports/custom/${report.uuid}`,
    }));
  }, [customReportsData?.reports, initialReportSwitcherItems]);

  const hasActiveCustomReportItem = activeCustomReportUuid
    ? reportSwitcherItems.some((item) => item.id === `custom-report:${activeCustomReportUuid}`)
    : false;

  const { data: activeCustomReportData } = useQuery<{ report?: CustomReportRecord | null }>({
    queryKey: ["dashboard-toolbar-active-custom-report", activeCustomReportUuid],
    enabled: reportBuilderEnabled && Boolean(activeCustomReportUuid) && !hasActiveCustomReportItem,
    queryFn: async () => {
      const response = await fetch(`/api/reports/custom/${activeCustomReportUuid}`);
      if (!response.ok) {
        return { report: null };
      }
      return (await response.json()) as { report?: CustomReportRecord | null };
    },
    staleTime: 0,
    gcTime: 0,
  });

  const resolvedReportSwitcherItems = useMemo<ReportBuilderMenuItem[]>(() => {
    if (!activeCustomReportUuid || hasActiveCustomReportItem) {
      return reportSwitcherItems;
    }

    return [
      {
        id: `custom-report:${activeCustomReportUuid}`,
        label: activeCustomReportData?.report?.name || "Custom report",
        href: `/dashboard/reports/custom/${activeCustomReportUuid}`,
      },
      ...reportSwitcherItems,
    ];
  }, [
    activeCustomReportData?.report?.name,
    activeCustomReportUuid,
    hasActiveCustomReportItem,
    reportSwitcherItems,
  ]);

  const reportBuilderMenuItems = useMemo<ReportBuilderMenuItem[]>(
    () => [...getDashboardReportBuilderMenuItems({ askAiEnabled }), ...resolvedReportSwitcherItems],
    [askAiEnabled, resolvedReportSwitcherItems],
  );

  return (
    <div className="sticky top-0 z-40 bg-(--theme-bg-primary) border-t border-b border-(--theme-border-primary) px-3 py-2 sm:px-6 sm:py-3 lg:px-8 shadow-[0_6px_14px_rgba(0,0,0,0.12)]">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <SiteSelector initialSites={initialSites} initialSiteId={initialSiteId} />
          {currentSiteId ? (
            <div className="hidden sm:flex">
              <CurrentVisitors siteId={currentSiteId} />
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2 relative">
          {reportBuilderEnabled ? (
            <ReportBuilderMenu
              items={reportBuilderMenuItems}
              activeItemId={activeReportBuilderItemId}
            />
          ) : null}
          {controls}
        </div>
      </div>

      {currentSiteId ? (
        <div className="flex sm:hidden items-center mt-1.5">
          <CurrentVisitors siteId={currentSiteId} />
        </div>
      ) : null}

      {footer}
    </div>
  );
}
