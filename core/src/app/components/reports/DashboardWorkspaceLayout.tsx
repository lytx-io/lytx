import type { LayoutProps } from "rwsdk/router";
import type { ReportBuilderActionId } from "@/app/components/ui/ReportBuilderMenu";
import { DashboardToolbar } from "@/app/components/reports/DashboardToolbar";

const resolveActiveReportBuilderItem = (pathname: string): ReportBuilderActionId => {
  if (pathname.includes("/dashboard/reports/create-reference")) return "create-reference";
  if (pathname.includes("/dashboard/reports/ask-ai")) return "ask-ai";
  if (pathname.includes("/dashboard/reports/create-dashboard")) return "create-dashboard";
  if (pathname.includes("/dashboard/reports/create-notification")) return "create-notification";
  return "create-report";
};

export function DashboardWorkspaceLayout({ children, requestInfo }: LayoutProps) {
  const pathname = requestInfo ? new URL(requestInfo.request.url).pathname : "/dashboard/reports/create-report";
  const activeReportBuilderItemId = resolveActiveReportBuilderItem(pathname);

  return (
    <>
      <DashboardToolbar activeReportBuilderItemId={activeReportBuilderItemId} />
      <div className="p-4 sm:p-6 lg:p-8">{children}</div>
    </>
  );
}
