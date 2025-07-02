import React from "react";

interface DashboardHeaderProps {
  siteName: string;
  setSiteName: (name: string) => void;
  currentVisitors: number;
}

const DashboardHeader = React.memo(function DashboardHeader({
  siteName,
  setSiteName,
  currentVisitors,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-center space-x-3">
      <span
        onClick={() => setSiteName("ww")}
        className="text-[var(--theme-text-primary)] font-semibold cursor-pointer"
      >
        {siteName}
      </span>
      <div className="flex items-center space-x-1">
        <svg
          className="h-3 w-3 fill-current text-[var(--color-secondary)]"
          viewBox="0 0 8 8"
        >
          <circle cx="4" cy="4" r="3" />
        </svg>
        <span className="text-sm text-[var(--theme-text-secondary)]">
          {currentVisitors} Current Visitors
        </span>
      </div>
    </div>
  );
});

export default DashboardHeader;
