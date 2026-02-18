import type { LayoutProps } from "rwsdk/router";
import type { ReportBuilderMenuActiveId } from "@/app/components/ui/ReportBuilderMenu";
import { DashboardWorkspaceShell } from "@/app/components/reports/DashboardWorkspaceShell";
import { isAskAiEnabled, isReportBuilderEnabled } from "@/lib/featureFlags";
import type { ToolbarSiteOption } from "@/app/components/reports/DashboardToolbar";

type LayoutContextLike = {
  session?: {
    last_site_id?: number | null;
  };
  sites?: Array<{
    site_id: number;
    name: string | null;
    tag_id: string;
  }> | null;
};

const resolveActiveReportBuilderItem = (pathname: string): ReportBuilderMenuActiveId => {
  const customReportMarker = "/dashboard/reports/custom/";
  if (pathname.includes(customReportMarker)) {
    const reportUuid = decodeURIComponent(pathname.slice(pathname.indexOf(customReportMarker) + customReportMarker.length));
    if (reportUuid && reportUuid !== "new" && !reportUuid.includes("/")) {
      return `custom-report:${reportUuid}`;
    }
  }

  if (pathname.includes("/dashboard/reports/create-reference")) return "create-reference";
  if (pathname.includes("/dashboard/reports/ask-ai")) return "ask-ai";
  if (pathname.includes("/dashboard/reports/create-dashboard")) return "create-dashboard";
  if (pathname.includes("/dashboard/reports/create-notification")) return "create-notification";
  return "create-report";
};

export function DashboardWorkspaceLayout({ children, requestInfo }: LayoutProps) {
  const pathname = requestInfo ? new URL(requestInfo.request.url).pathname : "/dashboard/reports/create-report";
  const activeReportBuilderItemId = resolveActiveReportBuilderItem(pathname);
  const reportBuilderEnabled = isReportBuilderEnabled();
  const askAiEnabled = reportBuilderEnabled && isAskAiEnabled();
  const ctx = requestInfo?.ctx as LayoutContextLike | undefined;

  const initialSites: ToolbarSiteOption[] = (ctx?.sites ?? []).map((site) => ({
    site_id: site.site_id,
    name: site.name || `Site ${site.site_id}`,
    tag_id: site.tag_id,
  }));

  const preferredSiteId = ctx?.session?.last_site_id ?? null;
  const initialSiteId = initialSites.some((site) => site.site_id === preferredSiteId)
    ? preferredSiteId
    : (initialSites[0]?.site_id ?? null);

  return (
    <DashboardWorkspaceShell
      activeReportBuilderItemId={activeReportBuilderItemId}
      reportBuilderEnabled={reportBuilderEnabled}
      askAiEnabled={askAiEnabled}
      initialSites={initialSites}
      initialSiteId={initialSiteId}
    >
      {children}
    </DashboardWorkspaceShell>
  );
}
