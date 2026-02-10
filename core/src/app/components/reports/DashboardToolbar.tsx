"use client";

import { useContext } from "react";
import type { ReactNode } from "react";
import { SiteSelector } from "@components/SiteSelector";
import { AuthContext } from "@/app/providers/AuthProvider";
import { CurrentVisitors } from "@/app/components/charts/ChartComponents";
import {
  ReportBuilderMenu,
  type ReportBuilderActionId,
} from "@/app/components/ui/ReportBuilderMenu";
import { dashboardReportBuilderMenuItems } from "@/app/components/reports/reportBuilderMenuItems";

type DashboardToolbarProps = {
  activeReportBuilderItemId?: ReportBuilderActionId;
  controls?: ReactNode;
  footer?: ReactNode;
};

export function DashboardToolbar({
  activeReportBuilderItemId = "create-report",
  controls,
  footer,
}: DashboardToolbarProps) {
  const { data: session, current_site } = useContext(AuthContext) || { data: null, current_site: null };

  const fallbackSiteId = session?.userSites?.[0]?.site_id;
  const currentSiteId = current_site?.id ?? fallbackSiteId;

  return (
    <div className="sticky top-0 z-40 bg-(--theme-bg-primary) border-t border-b border-(--theme-border-primary) px-3 py-2 sm:px-6 sm:py-3 lg:px-8 shadow-[0_6px_14px_rgba(0,0,0,0.12)]">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <SiteSelector />
          {currentSiteId ? (
            <div className="hidden sm:flex">
              <CurrentVisitors siteId={currentSiteId} />
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2 relative">
          <ReportBuilderMenu
            items={dashboardReportBuilderMenuItems}
            activeItemId={activeReportBuilderItemId}
          />
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
