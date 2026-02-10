"use client";

import React from "react";

type HeadingTag = "h2" | "h3" | "h4";

interface DashboardCardProps {
  id?: string;
  title?: React.ReactNode;
  titleAs?: HeadingTag;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  isUpdating?: boolean;
  updatingLabel?: string;
  empty?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      className="opacity-25"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const UpdatingOverlay = ({ label = "Updating..." }: { label?: string }) => (
  <div
    role="status"
    aria-live="polite"
    className="pointer-events-none absolute inset-0 flex items-center justify-center bg-(--theme-card-bg) bg-opacity-60 z-10 rounded-lg"
  >
    <div className="flex items-center">
      <SpinnerIcon className="w-5 h-5 text-(--theme-text-secondary) animate-spin" />
      <span className="ml-3 text-(--theme-text-secondary)">{label}</span>
    </div>
  </div>
);

const DefaultEmptyState = () => (
  <>
    <p className="text-(--theme-text-secondary)">
      No results match the current filters.
    </p>
    <p className="text-xs text-(--theme-text-secondary) mt-2">
      Try clearing filters or expanding the date range.
    </p>
  </>
);

const BASE_CLASSES =
  "bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-lg p-4 sm:p-6";

export function DashboardCard({
  id,
  title,
  titleAs: TitleTag = "h2",
  subtitle,
  actions,
  isUpdating,
  updatingLabel,
  empty,
  emptyState,
  className = "",
  children,
}: DashboardCardProps) {
  const needsRelative = Boolean(isUpdating);

  return (
    <div
      id={id}
      className={`${BASE_CLASSES} ${needsRelative ? "relative" : ""} ${className}`}
    >
      {(title || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div>
            {title && (
              <TitleTag className="text-lg sm:text-xl font-semibold text-(--theme-text-primary)">
                {title}
              </TitleTag>
            )}
            {subtitle && (
              <p className="text-sm text-(--theme-text-secondary)">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}

      {isUpdating && <UpdatingOverlay label={updatingLabel} />}

      {empty ? (emptyState ?? <DefaultEmptyState />) : children}
    </div>
  );
}

export default DashboardCard;
