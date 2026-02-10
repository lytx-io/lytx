import type { ReportBuilderMenuItem } from "@/app/components/ui/ReportBuilderMenu";

export const dashboardReportBuilderMenuItems: ReportBuilderMenuItem[] = [
  { id: "create-report", label: "Create report", href: "/dashboard/reports/create-report" },
  { id: "create-reference", label: "Create reference", href: "/dashboard/reports/create-reference" },
  { id: "ask-ai", label: "Ask AI", href: "/dashboard/reports/ask-ai" },
  { id: "create-dashboard", label: "Create dashboard", href: "/dashboard/reports/create-dashboard" },
  { id: "create-notification", label: "Create notification rule", href: "/dashboard/reports/create-notification" },
];
