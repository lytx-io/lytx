import React from "react";

interface DateRange {
  start: string;
  end: string;
  preset?: string;
}

interface DashboardFilters {
  dateRange: DateRange;
  deviceType?: string;
  country?: string;
  source?: string;
  siteId?: string;
}

interface DashboardControlsProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (open: boolean) => void;
  onDateRangeChange: (range: DateRange) => void;
  getDateRangeDisplay: () => string;
}

const DatePicker: React.FC<{
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ dateRange, onDateRangeChange, isOpen, onToggle }) => {
  const presets = [
    { label: "Last 7 days", days: 7 },
    { label: "Last 30 days", days: 30 },
    { label: "Last 90 days", days: 90 },
    { label: "Last 6 months", days: 180 },
    { label: "Last year", days: 365 },
  ];

  const getDateFromDaysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split("T")[0];
  };

  const getCurrentDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const handlePresetClick = (days: number, label: string) => {
    const newRange: DateRange = {
      start: getDateFromDaysAgo(days),
      end: getCurrentDate(),
      preset: label,
    };
    onDateRangeChange(newRange);
    onToggle();
  };

  const handleCustomDateChange = (field: "start" | "end", value: string) => {
    const newRange: DateRange = {
      ...dateRange,
      [field]: value,
      preset: undefined,
    };
    onDateRangeChange(newRange);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-[var(--theme-card-bg)] border border-[var(--theme-border-primary)] rounded-lg shadow-lg z-50">
      <div className="p-4">
        <h3 className="text-sm font-medium text-[var(--theme-text-primary)] mb-3">
          Select Date Range
        </h3>
        <div className="space-y-2 mb-4">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePresetClick(preset.days, preset.label)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                dateRange.preset === preset.label
                  ? "bg-[var(--color-primary)] text-white"
                  : "hover:bg-[var(--theme-bg-secondary)] text-[var(--theme-text-primary)]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="border-t border-[var(--theme-border-primary)] pt-4">
          <h4 className="text-xs font-medium text-[var(--theme-text-secondary)] mb-2">
            Custom Range
          </h4>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-[var(--theme-text-secondary)] mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  handleCustomDateChange("start", e.target.value)
                }
                className="w-full px-3 py-2 border border-[var(--theme-border-primary)] rounded text-sm bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--theme-text-secondary)] mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => handleCustomDateChange("end", e.target.value)}
                className="w-full px-3 py-2 border border-[var(--theme-border-primary)] rounded text-sm bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardControls = React.memo(function DashboardControls({
  filters,
  onFiltersChange,
  isDatePickerOpen,
  setIsDatePickerOpen,
  onDateRangeChange,
  getDateRangeDisplay,
}: DashboardControlsProps) {
  return (
    <div className="flex items-center space-x-3 relative">
      <button
        onClick={() => {
          // This would open the filter modal - we'll need to pass this handler from parent
        }}
        className="bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-primary)] font-medium py-2 px-4 rounded-md border border-[var(--theme-border-primary)] transition-colors"
      >
        Filter
      </button>
      <div className="relative">
        <button
          onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
          className="bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-primary)] py-2 px-4 rounded-md border border-[var(--theme-border-primary)] cursor-pointer transition-colors flex items-center space-x-2"
        >
          <span>{getDateRangeDisplay()}</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        <DatePicker
          dateRange={filters.dateRange}
          onDateRangeChange={onDateRangeChange}
          isOpen={isDatePickerOpen}
          onToggle={() => setIsDatePickerOpen(!isDatePickerOpen)}
        />
      </div>
    </div>
  );
});

export default DashboardControls;
