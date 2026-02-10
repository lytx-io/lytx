"use client";

import { DashboardCard } from "@components/DashboardCard";
import { Link } from "@components/ui/Link";
import {
  DashboardResponseData,
} from "@db/tranformReports";
type EventSummaryData = NonNullable<DashboardResponseData["EventSummary"]>;
type EventSummaryRow = {
  event: string | null;
  count: number;
  firstSeen: string | null;
  lastSeen: string | null;
};
type EventSummaryRowWithPercent = EventSummaryRow & { share: number };
const formatEventShare = (share: number) => {
  if (!Number.isFinite(share) || share <= 0) return "0%";
  if (share < 1) return "<1%";
  return `${share.toFixed(0)}%`;
};
const formatEventDate = (value: string | null, timezone: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return date.toLocaleString(undefined, {
      timeZone: timezone,
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return date.toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
};
export const EventSummaryTable = ({
  data,
  isLoading,
  timezone,
}: {
  data: EventSummaryData | null | undefined;
  isLoading: boolean;
  timezone: string;
}) => {
  const summary = data?.summary ?? [];
  const totalEvents = data?.totalEvents ?? 0;
  const rows = summary.map((row): EventSummaryRowWithPercent => ({
    ...row,
    share: totalEvents > 0 ? (row.count / totalEvents) * 100 : 0,
  }));

  const eventCountSummary = (
    <div className="flex items-center gap-3 text-sm text-(--theme-text-secondary)">
      <span>
        <span className="font-semibold text-(--theme-text-primary)">
          {totalEvents.toLocaleString()}
        </span>{" "}
        total events •{" "}
        <span className="font-semibold text-(--theme-text-primary)">
          {(data?.totalEventTypes ?? 0).toLocaleString()}
        </span>{" "}
        event types
      </span>
      <Link
        href="/dashboard/events"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        View all
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </Link>
    </div>
  );

  return (
    <DashboardCard
      title="Events Overview"
      titleAs="h3"
      subtitle="All captured events with rollups by name."
      actions={eventCountSummary}
      isUpdating={isLoading}
      updatingLabel="Updating events..."
      empty={rows.length === 0}
      emptyState={
        <div className="rounded-md border border-(--theme-border-primary) bg-(--theme-bg-secondary) p-6 text-center">
          <p className="text-sm text-(--theme-text-secondary)">
            No events captured for this date range.
          </p>
        </div>
      }
    >
      <div className="relative w-full">
        <div className="overflow-y-auto overflow-x-auto scrollbar-none max-h-80">
          <table className="min-w-180 w-full divide-y divide-(--theme-border-primary)">
            <thead className="bg-(--theme-bg-secondary) sticky top-0 z-10">
              <tr>
                <th
                  scope="col"
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-(--theme-text-secondary) uppercase tracking-wider"
                >
                  Event
                </th>
                <th
                  scope="col"
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-(--theme-text-secondary) uppercase tracking-wider"
                >
                  Count
                </th>
                <th
                  scope="col"
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-(--theme-text-secondary) uppercase tracking-wider"
                >
                  Share
                </th>
                <th
                  scope="col"
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-(--theme-text-secondary) uppercase tracking-wider"
                >
                  First Seen
                </th>
                <th
                  scope="col"
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-(--theme-text-secondary) uppercase tracking-wider"
                >
                  Last Seen
                </th>
              </tr>
            </thead>
            <tbody className="bg-(--theme-card-bg) divide-y divide-(--theme-border-primary)">
              {rows.map((row) => (
                <tr
                  key={`${row.event ?? "unknown"}-${row.firstSeen ?? ""}-${row.lastSeen ?? ""}`}
                  className="hover:bg-(--theme-bg-secondary) transition-colors"
                >
                  <td className="px-3 sm:px-6 py-4 text-sm text-(--theme-text-primary)">
                    {row.event || "Unknown"}
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-sm text-(--theme-text-primary)">
                    {row.count.toLocaleString()}
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-sm text-(--theme-text-primary)">
                    {formatEventShare(row.share)}
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-sm text-(--theme-text-primary)">
                    {formatEventDate(row.firstSeen, timezone)}
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-sm text-(--theme-text-primary)">
                    {formatEventDate(row.lastSeen, timezone)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-linear-to-l from-(--theme-card-bg) to-transparent sm:hidden" />
      </div>
    </DashboardCard>
  );
}
