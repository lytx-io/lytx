"use client";

import { useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SiteSelector } from "@components/SiteSelector";
import { AuthContext } from "@/app/providers/AuthProvider";
import type { DashboardResponseData } from "@db/tranformReports";
import type { EventLabelSelect } from "@db/d1/schema";

type EventSummaryData = NonNullable<DashboardResponseData["EventSummary"]>;

type EventSummaryRow = EventSummaryData["summary"][number];

type EventSummaryRowWithShare = EventSummaryRow & { share: number };

type DateParts = { year: number; month: number; day: number };

const isValidTimeZone = (value: unknown): value is string => {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
};

const getBrowserTimeZone = (): string => {
  const guessed = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(guessed) ? guessed : "UTC";
};

const formatDateParts = ({ year, month, day }: DateParts): string => {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
};

const getDatePartsInTimeZone = (date: Date, timeZone: string): DateParts => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return {
    year: Number.isFinite(year) ? year : date.getUTCFullYear(),
    month: Number.isFinite(month) ? month : date.getUTCMonth() + 1,
    day: Number.isFinite(day) ? day : date.getUTCDate(),
  };
};

const getDateStringInTimeZone = (date: Date, timeZone: string): string => {
  return formatDateParts(getDatePartsInTimeZone(date, timeZone));
};

const shiftDateString = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map((value) => Number(value));
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return formatDateParts({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
};

const formatEventDate = (value: string | null, timezone: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
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

const formatEventShare = (share: number) => {
  if (!Number.isFinite(share) || share <= 0) return "0%";
  if (share < 1) return "<1%";
  return `${share.toFixed(0)}%`;
};

/** Check if an event is an autocapture event */
const isAutocaptureEvent = (eventName: string | null): boolean => {
  return eventName?.startsWith("$ac_") ?? false;
};

/** Check if an event is a rule capture event */
const isRuleCaptureEvent = (eventName: string | null): boolean => {
  return eventName === "auto_capture";
};

const isManualCaptureEvent = (eventName: string | null): boolean => {
  if (!eventName) return false;
  if (isAutocaptureEvent(eventName) || isRuleCaptureEvent(eventName)) return false;
  return eventName !== "page_view";
};

/** Parse autocapture event name into parts */
const parseAutocaptureEvent = (eventName: string): {
  elementType: string;
  elementText: string;
  elementId: string | null;
} => {
  // Format: $ac_link_ElementText_elementId or $ac_form_FormName_formId
  const parts = eventName.split('_');
  // parts[0] = "$ac", parts[1] = type, parts[2] = text, parts[3] = id (optional)
  const elementType = parts[1] || 'unknown';
  const elementText = parts[2] || 'unnamed';
  const elementId = parts[3] || null;
  
  return { elementType, elementText, elementId };
};

/** Get a human-readable display name for autocapture events */
const getAutocaptureDisplayName = (eventName: string): string => {
  const { elementText, elementId } = parseAutocaptureEvent(eventName);
  
  // Show: "Element Text" or "Element Text_id" if id exists
  if (elementId) {
    return `${elementText}_${elementId}`;
  }
  return elementText;
};

/** Get element type badge text */
const getAutocaptureTypeBadge = (eventName: string): string => {
  const { elementType } = parseAutocaptureEvent(eventName);
  // Capitalize first letter
  return elementType.charAt(0).toUpperCase() + elementType.slice(1);
};

/** Badge component for event type */
const EventTypeBadge = ({
  isAutocapture,
  eventName,
}: {
  isAutocapture: boolean;
  eventName: string | null;
}) => {
  if (isAutocapture && eventName) {
    const typeBadge = getAutocaptureTypeBadge(eventName);
    return (
      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
        {typeBadge}
      </span>
    );
  }
  return null;
};

const getAutocaptureMethod = (eventName: string): string => {
  const { elementType } = parseAutocaptureEvent(eventName);
  if (elementType === "form") return "Submit";
  if (elementType === "input") return "Change";
  return "Click";
};

const getCaptureMeta = (
  eventName: string | null,
): { label: string; method?: string } | null => {
  if (isAutocaptureEvent(eventName)) {
    return {
      label: "Auto Capture",
      method: eventName ? getAutocaptureMethod(eventName) : undefined,
    };
  }
  if (isRuleCaptureEvent(eventName)) {
    return { label: "Auto Capture", method: "Rule" };
  }
  if (isManualCaptureEvent(eventName)) {
    return { label: "Event Capture" };
  }
  return null;
};

const CaptureMethodBadge = ({ eventName }: { eventName: string | null }) => {
  const meta = getCaptureMeta(eventName);
  if (!meta?.method) return null;
  return (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      {meta.method}
    </span>
  );
};

/** Pencil icon for edit button */
const PencilIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

/** Check icon for save button */
const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

/** X icon for cancel button */
const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/** Trash icon for delete button */
const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

/** Inline label editor component */
const LabelEditor = ({ 
  eventName, 
  currentLabel, 
  siteId,
  onSave,
  onDelete,
  isSaving,
}: { 
  eventName: string; 
  currentLabel: string | null;
  siteId: number;
  onSave: (eventName: string, label: string) => void;
  onDelete: (eventName: string) => void;
  isSaving: boolean;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentLabel || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed) {
      onSave(eventName, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(currentLabel || "");
    setIsEditing(false);
  };

  const handleDelete = () => {
    onDelete(eventName);
    setEditValue("");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter custom label..."
          className="flex-1 px-2 py-1 text-xs rounded border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-primary)] min-w-[120px]"
          disabled={isSaving}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !editValue.trim()}
          className="p-1 rounded text-green-500 hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Save label"
        >
          <CheckIcon />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
          className="p-1 rounded text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-secondary)]"
          title="Cancel"
        >
          <XIcon />
        </button>
        {currentLabel && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSaving}
            className="p-1 rounded text-red-500 hover:bg-red-500/10 disabled:opacity-50"
            title="Remove label"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group/label">
      {currentLabel && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
          {currentLabel}
        </span>
      )}
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="p-1 rounded text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-secondary)] opacity-0 group-hover/label:opacity-100 transition-opacity"
        title={currentLabel ? "Edit label" : "Add label"}
      >
        <PencilIcon />
      </button>
    </div>
  );
};

export function EventsPage() {
  const authContext = useContext(AuthContext);
  const { current_site, isPending: isSessionLoading, data: session } = authContext || {
    current_site: null,
    isPending: true,
    data: null,
  };
  const queryClient = useQueryClient();
  const browserTimezone = useMemo(() => getBrowserTimeZone(), []);
  const savedTimezone = session?.timezone;
  const effectiveTimezone = isValidTimeZone(savedTimezone)
    ? savedTimezone
    : browserTimezone;

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const hasInitializedDateRange = useRef(false);
  const itemsPerPage = 25;
  const offset = (currentPage - 1) * itemsPerPage;

  useEffect(() => {
    if (isSessionLoading || hasInitializedDateRange.current) return;

    const endDate = getDateStringInTimeZone(new Date(), effectiveTimezone);
    const startDate = shiftDateString(endDate, -30);

    setDateRange({
      start: startDate,
      end: endDate,
    });
    hasInitializedDateRange.current = true;
  }, [effectiveTimezone, isSessionLoading]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange.start, dateRange.end, searchTerm]);

  // Fetch event labels for this site
  const labelsQuery = useQuery<EventLabelSelect[], Error>({
    queryKey: ["event-labels", current_site?.id],
    queryFn: async () => {
      if (!current_site?.id) return [];
      const response = await fetch(`/api/event-labels?site_id=${current_site.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch event labels");
      }
      return response.json();
    },
    enabled: Boolean(current_site?.id),
  });

  // Create a map of event names to labels for quick lookup
  const labelsMap = useMemo(() => {
    const map = new Map<string, string>();
    if (labelsQuery.data) {
      for (const label of labelsQuery.data) {
        map.set(label.event_name, label.label);
      }
    }
    return map;
  }, [labelsQuery.data]);

  // Save label mutation
  const saveLabelMutation = useMutation({
    mutationFn: async ({ eventName, label }: { eventName: string; label: string }) => {
      const response = await fetch("/api/event-labels/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: current_site?.id,
          event_name: eventName,
          label: label,
        }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Failed to save label");
      }
      return response.json() as Promise<EventLabelSelect>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-labels", current_site?.id] });
    },
  });

  // Delete label mutation
  const deleteLabelMutation = useMutation({
    mutationFn: async (eventName: string) => {
      const response = await fetch("/api/event-labels/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: current_site?.id,
          event_name: eventName,
        }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Failed to delete label");
      }
      return response.json() as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-labels", current_site?.id] });
    },
  });

  const handleSaveLabel = useCallback((eventName: string, label: string) => {
    saveLabelMutation.mutate({ eventName, label });
  }, [saveLabelMutation]);

  const handleDeleteLabel = useCallback((eventName: string) => {
    deleteLabelMutation.mutate(eventName);
  }, [deleteLabelMutation]);

  const eventsQuery = useQuery<DashboardResponseData, Error>({
    queryKey: [
      "events-summary",
      current_site?.id,
      dateRange.start,
      dateRange.end,
      offset,
      itemsPerPage,
      searchTerm,
      effectiveTimezone,
    ],
    queryFn: async () => {
      if (!current_site?.id) {
        throw new Error("Select a site to view events.");
      }

      const response = await fetch("/api/dashboard/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: current_site.id,
          date_start: dateRange.start,
          date_end: dateRange.end,
          timezone: effectiveTimezone,
          event_summary_offset: offset,
          event_summary_limit: itemsPerPage,
          event_summary_search: searchTerm || undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | DashboardResponseData
        | { error?: string; requestId?: string }
        | null;

      if (!response.ok) {
        const message =
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : response.statusText;
        const requestId =
          payload && "requestId" in payload && typeof payload.requestId === "string"
            ? payload.requestId
            : null;
        throw new Error(requestId ? `${message} (requestId: ${requestId})` : message);
      }

      return payload as DashboardResponseData;
    },
    enabled: Boolean(current_site?.id && dateRange.start && dateRange.end),
  });

  const eventSummary = eventsQuery.data?.EventSummary ?? null;
  const totalEvents = eventSummary?.totalEvents ?? 0;
  const summaryRows = useMemo((): EventSummaryRowWithShare[] => {
    const rows = eventSummary?.summary ?? [];
    return rows.map((row) => ({
      ...row,
      share: totalEvents > 0 ? (row.count / totalEvents) * 100 : 0,
    }));
  }, [eventSummary, totalEvents]);
  const isDateRangeReady = Boolean(dateRange.start && dateRange.end);
  const totalPages = eventSummary?.pagination
    ? Math.max(1, Math.ceil(eventSummary.pagination.total / eventSummary.pagination.limit))
    : 1;
  const currentSummaryPage = eventSummary?.pagination
    ? Math.floor(eventSummary.pagination.offset / eventSummary.pagination.limit) + 1
    : 1;

  if (isSessionLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center py-12">
            <span className="text-[var(--theme-text-secondary)]">
              Loading session...
            </span>
          </div>
        </main>
      </div>
    );
  }

  if (!current_site?.id) {
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center py-12">
            <span className="text-[var(--theme-text-secondary)]">
              Select a site to view event analytics.
            </span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="w-full px-4 py-4 sm:p-6 border-t border-b border-[var(--theme-border-primary)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-[var(--theme-text-primary)] font-semibold">
              <SiteSelector />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--theme-text-secondary)]">
                  Start
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(event) =>
                    setDateRange((prev) => ({ ...prev, start: event.target.value }))
                  }
                  className="px-3 py-2 text-sm rounded-md border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-primary)]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--theme-text-secondary)]">End</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(event) =>
                    setDateRange((prev) => ({ ...prev, end: event.target.value }))
                  }
                  className="px-3 py-2 text-sm rounded-md border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-primary)]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--theme-text-secondary)]">
                  Search
                </label>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Event name"
                  className="w-full sm:w-48 px-3 py-2 text-sm rounded-md border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-primary)]"
                />
              </div>
            </div>
          </div>

      </div>

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[var(--theme-text-primary)]">
                  Events
                </h1>
                <p className="text-sm text-[var(--theme-text-secondary)]">
                  Captured events grouped by name, including auto-capture and custom events.
                  <span className="ml-1 text-xs">Hover over events to add custom labels.</span>
                </p>
              </div>
              <div className="text-sm text-[var(--theme-text-secondary)]">
                <span className="font-semibold text-[var(--theme-text-primary)]">
                  {totalEvents.toLocaleString()}
                </span>{" "}
                total events{" "}
                <span className="font-semibold text-[var(--theme-text-primary)]">
                  {(eventSummary?.totalEventTypes ?? 0).toLocaleString()}
                </span>{" "}
                event types
                <span className="ml-2 text-xs text-[var(--theme-text-secondary)]">
                  Page {currentSummaryPage} of {totalPages}
                </span>
              </div>
            </div>

            {/* Custom Event Capture Guide */}
            <details className="mb-6 rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-card-bg)]">
              <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-secondary)] rounded-lg">
                How to capture custom events
              </summary>
              <div className="px-4 pb-4 pt-2 border-t border-[var(--theme-border-primary)]">
                <p className="text-sm text-[var(--theme-text-secondary)] mb-3">
                  Use the Lytx API to track custom events from your website:
                </p>
                <div className="bg-[var(--theme-bg-secondary)] rounded-md p-3 font-mono text-sm overflow-x-auto">
                  <div className="text-[var(--theme-text-secondary)] mb-2">// Basic event</div>
                  <div className="text-[var(--theme-text-primary)]">window.lytxApi.capture(<span className="text-green-500">"button_click"</span>)</div>
                  <div className="text-[var(--theme-text-secondary)] mt-3 mb-2">// Event with custom data</div>
                  <div className="text-[var(--theme-text-primary)]">window.lytxApi.capture(<span className="text-green-500">"purchase"</span>, {"{"}</div>
                  <div className="text-[var(--theme-text-primary)] pl-4">product_id: <span className="text-green-500">"123"</span>,</div>
                  <div className="text-[var(--theme-text-primary)] pl-4">value: <span className="text-green-500">"49.99"</span></div>
                  <div className="text-[var(--theme-text-primary)]">{"}"})</div>
                </div>
                <p className="text-xs text-[var(--theme-text-secondary)] mt-3">
                  <span className="font-medium">Tip:</span> Add <code className="bg-[var(--theme-bg-secondary)] px-1 rounded">?lytxDebug</code> to your URL to enable debug mode and see events in the console.
                </p>
              </div>
            </details>


          {!isDateRangeReady ? (
            <div className="rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-card-bg)] p-6 text-center text-[var(--theme-text-secondary)]">
              Preparing date range...
            </div>
          ) : eventsQuery.isLoading ? (
            <div className="rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-card-bg)] p-6 text-center text-[var(--theme-text-secondary)]">
              Loading events...
            </div>
          ) : eventsQuery.error ? (
            <div className="rounded-lg border border-red-500 bg-red-500/10 p-6 text-center text-red-400">
              {eventsQuery.error.message}
            </div>
          ) : summaryRows.length === 0 ? (
            <div className="rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-card-bg)] p-6 text-center text-[var(--theme-text-secondary)]">
              No events captured for this date range.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-card-bg)]">
              <table className="min-w-[720px] w-full divide-y divide-[var(--theme-border-primary)]">
                <thead className="bg-[var(--theme-bg-secondary)]">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider"
                    >
                      Event
                    </th>
                    <th
                      scope="col"
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider"
                    >
                      Count
                    </th>
                    <th
                      scope="col"
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider"
                    >
                      Share
                    </th>
                    <th
                      scope="col"
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider"
                    >
                      First Seen
                    </th>
                    <th
                      scope="col"
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider"
                    >
                      Last Seen
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--theme-card-bg)] divide-y divide-[var(--theme-border-primary)]">
                  {summaryRows.map((row) => {
                    const isAuto = isAutocaptureEvent(row.event);
                    const isRuleCapture = isRuleCaptureEvent(row.event);
                    const captureMeta = getCaptureMeta(row.event);
                    const customLabel = row.event ? labelsMap.get(row.event) : null;
                    const displayName = customLabel 
                      ? customLabel
                      : isAuto && row.event 
                        ? getAutocaptureDisplayName(row.event)
                        : (row.event || "Unknown");
                    
                    return (
                      <tr
                        key={`${row.event ?? "unknown"}-${row.firstSeen ?? ""}-${row.lastSeen ?? ""}`}
                        className="hover:bg-[var(--theme-bg-secondary)] transition-colors group"
                      >
                        <td className="px-3 sm:px-6 py-4 text-sm text-[var(--theme-text-primary)]">
                          <div className="flex items-center">
                            <span className={customLabel ? "font-medium" : ""}>{displayName}</span>
                            <EventTypeBadge isAutocapture={isAuto} eventName={row.event} />
                            <CaptureMethodBadge eventName={row.event} />
                          </div>
                          {/* Show original event name if there's a custom label or it's autocapture */}
                          {(customLabel || isAuto || isRuleCapture) && row.event && (
                            <div className="text-xs text-[var(--theme-text-secondary)] mt-1 font-mono">
                              {row.event}
                            </div>
                          )}
                          {captureMeta && (
                            <div className="text-xs text-[var(--theme-text-secondary)] mt-1">
                              <span className="font-medium text-[var(--theme-text-primary)]">
                                {captureMeta.label}
                              </span>
                              {captureMeta?.method && (
                                <span className="ml-1 text-[var(--theme-text-secondary)]">
                                  · {captureMeta.method}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Label editor - always available */}
                          {row.event && current_site?.id && (
                            <LabelEditor
                              eventName={row.event}
                              currentLabel={customLabel ?? null}
                              siteId={current_site.id}
                              onSave={handleSaveLabel}
                              onDelete={handleDeleteLabel}
                              isSaving={saveLabelMutation.isPending || deleteLabelMutation.isPending}
                            />
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm text-[var(--theme-text-primary)]">
                          {row.count.toLocaleString()}
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm text-[var(--theme-text-primary)]">
                          {formatEventShare(row.share)}
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm text-[var(--theme-text-primary)]">
                          {formatEventDate(row.firstSeen, effectiveTimezone)}
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm text-[var(--theme-text-primary)]">
                          {formatEventDate(row.lastSeen, effectiveTimezone)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {eventSummary?.pagination && summaryRows.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">
              <p className="text-xs text-[var(--theme-text-secondary)]">
                Showing {eventSummary.pagination.offset + 1}-
                {Math.min(
                  eventSummary.pagination.offset + eventSummary.pagination.limit,
                  eventSummary.pagination.total,
                )} of {eventSummary.pagination.total} event types
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentSummaryPage === 1}
                  className="px-3 py-1 text-xs rounded border border-[var(--theme-border-primary)] text-[var(--theme-text-secondary)] disabled:opacity-50"
                >
                  First
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentSummaryPage === 1}
                  className="px-3 py-1 text-xs rounded border border-[var(--theme-border-primary)] text-[var(--theme-text-secondary)] disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-[var(--theme-text-secondary)]">
                  Page {currentSummaryPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentSummaryPage >= totalPages}
                  className="px-3 py-1 text-xs rounded border border-[var(--theme-border-primary)] text-[var(--theme-text-secondary)] disabled:opacity-50"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentSummaryPage >= totalPages}
                  className="px-3 py-1 text-xs rounded border border-[var(--theme-border-primary)] text-[var(--theme-text-secondary)] disabled:opacity-50"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default EventsPage;
