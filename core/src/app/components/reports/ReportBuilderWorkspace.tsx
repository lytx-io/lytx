"use client";

import { useMemo } from "react";
import { CreateReportStarter } from "@/app/components/reports/CreateReportStarter";
import { AskAiWorkspace } from "@/app/components/reports/AskAiWorkspace";
import type { ReportBuilderActionId } from "@/app/components/ui/ReportBuilderMenu";

type ReportBuilderWorkspaceProps = {
  activeReportBuilderItemId: ReportBuilderActionId;
  initialAiConfigured?: boolean;
  initialAiModel?: string;
};

const reportWorkspaceCopy: Partial<Record<Exclude<ReportBuilderActionId, "create-report">, { title: string; description: string }>> = {
  "create-reference": {
    title: "Create reference",
    description: "Reference report setup is next. This route is now separated and ready for dedicated UI.",
  },
  "create-dashboard": {
    title: "Create dashboard",
    description: "Dashboard builder setup is next. This route is now separated and ready for dedicated UI.",
  },
  "create-notification": {
    title: "Create notification rule",
    description: "Notification rule setup is next. This route is now separated and ready for dedicated UI.",
  },
};

export function ReportBuilderWorkspace({
  activeReportBuilderItemId,
  initialAiConfigured = false,
  initialAiModel = "",
}: ReportBuilderWorkspaceProps) {
  const inactiveCopy = useMemo(
    () =>
      activeReportBuilderItemId === "create-report"
        ? null
        : reportWorkspaceCopy[activeReportBuilderItemId],
    [activeReportBuilderItemId],
  );

  if (activeReportBuilderItemId === "create-report") {
    return (
      <>
        <CreateReportStarter
          onStartCustomReport={() => {
            window.location.assign("/dashboard/reports/custom/new");
          }}
          onStartTemplate={(templateId) => {
            const query = new URLSearchParams({ template: templateId });
            window.location.assign(`/dashboard/reports/custom/new?${query.toString()}`);
          }}
        />
      </>
    );
  }

  if (activeReportBuilderItemId === "ask-ai") {
    return (
      <AskAiWorkspace initialAiConfigured={initialAiConfigured} initialAiModel={initialAiModel} />
    );
  }

  return (
    <section className="max-w-4xl mx-auto">
      <div className="rounded-xl border border-(--theme-border-primary) bg-(--theme-card-bg) p-6 sm:p-8">
        <h2 className="text-2xl font-semibold text-(--theme-text-primary)">
          {inactiveCopy?.title}
        </h2>
        <p className="mt-2 text-(--theme-text-secondary)">
          {inactiveCopy?.description}
        </p>
      </div>
    </section>
  );
}
