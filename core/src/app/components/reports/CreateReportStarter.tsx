"use client";

type ReportTemplateCard = {
  id: string;
  title: string;
  description: string;
};

const reportTemplateCards: ReportTemplateCard[] = [
  {
    id: "ecomm-tracker",
    title: "Ecomm Tracker",
    description: "Monitor storefront traffic, product views, cart starts, and checkout conversion in one report.",
  },
  {
    id: "marketing-leads",
    title: "Marketing leads",
    description: "Track landing-page engagement, lead-form submissions, and channel quality for campaign optimization.",
  },
];

type CreateReportStarterProps = {
  onStartCustomReport: () => void;
  onStartTemplate: (templateId: string) => void;
};

export function CreateReportStarter({ onStartCustomReport, onStartTemplate }: CreateReportStarterProps) {
  return (
    <section className="max-w-5xl mx-auto space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-semibold text-(--theme-text-primary)">
          Start a report
        </h2>
        <p className="text-(--theme-text-secondary)">
          Build a custom report from scratch or start from a saved template.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={onStartCustomReport}
          className="group rounded-xl border border-dashed border-(--theme-border-primary) bg-(--theme-bg-secondary) hover:bg-(--theme-bg-tertiary) p-5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary)"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-(--theme-border-primary) text-(--theme-text-primary) mb-4">
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </span>
          <p className="text-base font-semibold text-(--theme-text-primary)">Build custom report</p>
          <p className="mt-1 text-sm text-(--theme-text-secondary)">
            Start with a blank canvas and add the metrics and dimensions you need.
          </p>
        </button>

        {reportTemplateCards.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onStartTemplate(template.id)}
            className="rounded-xl border border-(--theme-border-primary) bg-(--theme-card-bg) hover:bg-(--theme-bg-secondary) p-5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary)"
          >
            <p className="text-base font-semibold text-(--theme-text-primary)">{template.title}</p>
            <p className="mt-1 text-sm text-(--theme-text-secondary)">{template.description}</p>
            <span className="mt-4 inline-flex items-center text-xs font-medium text-(--theme-text-secondary)">
              Use template
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
