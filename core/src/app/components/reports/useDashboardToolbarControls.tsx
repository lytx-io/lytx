"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  DatePicker,
  FilterModal,
  HelpTooltip,
  SpinnerIcon,
  type DashboardFilters,
  type DashboardNotice,
  type DateRange,
} from "@/app/components/charts/ChartComponents";

type UseDashboardToolbarControlsParams = {
  filters: DashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  timezone: string;
  onNotify?: (notice: DashboardNotice) => void;
  isUpdating?: boolean;
  deviceTypeOptions?: string[];
  countryOptions?: string[];
  cityOptions?: string[];
  regionOptions?: string[];
  sourceOptions?: string[];
  pageUrlOptions?: string[];
  eventNameOptions?: string[];
};

type DashboardToolbarControlsResult = {
  controls: ReactNode;
  footer: ReactNode;
  modal: ReactNode;
};

const getDateRangeDisplay = (dateRange: DateRange) => {
  if (!dateRange.start || !dateRange.end) {
    return "Loading dates...";
  }
  if (dateRange.preset) {
    return dateRange.preset;
  }
  return `${dateRange.start} to ${dateRange.end}`;
};

export function useDashboardToolbarControls({
  filters,
  setFilters,
  timezone,
  onNotify,
  isUpdating = false,
  deviceTypeOptions = [],
  countryOptions = [],
  cityOptions = [],
  regionOptions = [],
  sourceOptions = [],
  pageUrlOptions = [],
  eventNameOptions = [],
}: UseDashboardToolbarControlsParams): DashboardToolbarControlsResult {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const handleFiltersChange = useCallback(
    (nextFilters: DashboardFilters) => {
      setFilters(nextFilters);

      const hasAnyFilter =
        !!nextFilters.deviceType ||
        !!nextFilters.country ||
        !!nextFilters.city ||
        !!nextFilters.region ||
        !!nextFilters.source ||
        !!nextFilters.pageUrl ||
        !!nextFilters.eventName;

      onNotify?.({
        type: "info",
        message: hasAnyFilter ? "Filters updated." : "All filters cleared.",
      });
    },
    [onNotify, setFilters],
  );

  const handleDateRangeChange = useCallback(
    (nextDateRange: DateRange) => {
      setFilters((prev) => ({ ...prev, dateRange: nextDateRange }));
      onNotify?.({ type: "info", message: "Date range updated." });
    },
    [onNotify, setFilters],
  );

  const controls = useMemo<ReactNode>(
    () => (
      <>
        <button
          type="button"
          onClick={() => setIsFilterModalOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isFilterModalOpen}
          className="bg-(--theme-bg-secondary) hover:bg-(--theme-bg-tertiary) text-(--theme-text-primary) font-medium h-9 sm:h-auto px-2.5 sm:py-2 sm:px-4 text-sm rounded-md border border-(--theme-border-primary) transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary)"
        >
          Filter
        </button>

        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDatePickerOpen((prev) => !prev)}
            aria-haspopup="dialog"
            aria-expanded={isDatePickerOpen}
            className="bg-(--theme-bg-secondary) hover:bg-(--theme-bg-tertiary) text-(--theme-text-primary) font-medium h-9 sm:h-auto px-2.5 sm:py-2 sm:px-4 text-sm rounded-md border border-(--theme-border-primary) cursor-pointer transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary)"
          >
            <span className="truncate max-w-32 sm:max-w-56">{getDateRangeDisplay(filters.dateRange)}</span>
            <svg
              aria-hidden="true"
              focusable="false"
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div className="hidden sm:flex">
            <HelpTooltip text="Change the reporting period. Presets update immediately; custom dates apply when the picker closes." />
          </div>

          <DatePicker
            dateRange={filters.dateRange}
            onDateRangeChange={handleDateRangeChange}
            isOpen={isDatePickerOpen}
            onToggle={() => setIsDatePickerOpen((prev) => !prev)}
            timezone={timezone}
          />
        </div>
      </>
    ),
    [filters.dateRange, handleDateRangeChange, isDatePickerOpen, isFilterModalOpen, timezone],
  );

  const footer = useMemo<ReactNode>(
    () => {
      const chips: Array<{ label: string; key: keyof DashboardFilters }> = [];
      if (filters.deviceType) chips.push({ label: `Device: ${filters.deviceType}`, key: "deviceType" });
      if (filters.country) chips.push({ label: `Country: ${filters.country}`, key: "country" });
      if (filters.region) chips.push({ label: `Region: ${filters.region}`, key: "region" });
      if (filters.city) chips.push({ label: `City: ${filters.city}`, key: "city" });
      if (filters.source) chips.push({ label: `Source: ${filters.source}`, key: "source" });
      if (filters.pageUrl) chips.push({ label: `Page: ${filters.pageUrl}`, key: "pageUrl" });
      if (filters.eventName) chips.push({ label: `Event: ${filters.eventName}`, key: "eventName" });

      return (
        <>
          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {chips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 rounded-full bg-(--theme-bg-tertiary) border border-(--theme-border-primary) px-2.5 py-0.5 text-xs text-(--theme-text-primary)"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, [chip.key]: undefined }))}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-(--theme-bg-secondary) transition-colors focus:outline-none focus:ring-1 focus:ring-(--theme-border-secondary)"
                    aria-label={`Remove ${chip.label} filter`}
                  >
                    <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({
                    dateRange: prev.dateRange,
                    siteId: prev.siteId,
                  }))
                }
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs text-(--theme-text-secondary) hover:text-(--theme-text-primary) transition-colors focus:outline-none focus:ring-1 focus:ring-(--theme-border-secondary)"
              >
                Clear all
              </button>
            </div>
          ) : null}

          {isUpdating ? (
            <div className="flex items-center gap-2 mt-2 text-xs text-(--theme-text-secondary)">
              <SpinnerIcon className="w-3 h-3 animate-spin" />
              <span>Updating dashboard...</span>
            </div>
          ) : null}
        </>
      );
    },
    [filters, isUpdating, setFilters],
  );

  const modal = useMemo<ReactNode>(
    () => (
      <FilterModal
        filters={filters}
        onFiltersChange={handleFiltersChange}
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onNotify={(notice) => onNotify?.(notice)}
        deviceTypeOptions={deviceTypeOptions}
        countryOptions={countryOptions}
        cityOptions={cityOptions}
        regionOptions={regionOptions}
        sourceOptions={sourceOptions}
        pageUrlOptions={pageUrlOptions}
        eventNameOptions={eventNameOptions}
      />
    ),
    [
      cityOptions,
      countryOptions,
      deviceTypeOptions,
      eventNameOptions,
      filters,
      handleFiltersChange,
      isFilterModalOpen,
      onNotify,
      pageUrlOptions,
      regionOptions,
      sourceOptions,
    ],
  );

  return { controls, footer, modal };
}
