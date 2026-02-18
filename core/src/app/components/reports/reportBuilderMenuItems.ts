import type { ReportBuilderMenuItem } from "@/app/components/ui/ReportBuilderMenu";

export const getDashboardReportBuilderMenuItems = ({
  askAiEnabled,
}: {
  askAiEnabled: boolean;
}): ReportBuilderMenuItem[] => {
  const items: ReportBuilderMenuItem[] = [
    { id: "create-report", label: "Create report", href: "/dashboard/reports/create-report" },
  ];

  if (askAiEnabled) {
    items.push({ id: "ask-ai", label: "Ask AI", href: "/dashboard/reports/ask-ai" });
  }

  return items;
};
