"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "./Link";

export type ReportBuilderActionId =
  | "create-report"
  | "create-reference"
  | "ask-ai"
  | "create-dashboard"
  | "create-notification";

export type ReportBuilderMenuItem = {
  id: "create-report" | "create-reference" | "ask-ai" | "create-dashboard" | "create-notification";
  label: string;
  href?: string;
  onSelect?: () => void;
};

export const defaultReportBuilderMenuItems: ReportBuilderMenuItem[] = [
  { id: "create-report", label: "Create report" },
  { id: "create-reference", label: "Create reference" },
  { id: "ask-ai", label: "Ask AI" },
  { id: "create-dashboard", label: "Create dashboard" },
  { id: "create-notification", label: "Create notification rule" },
];

const ReportBuilderItemIcon = ({ itemId }: { itemId: ReportBuilderActionId }) => {
  if (itemId === "create-report") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20h16" />
        <path d="M6 16V8" />
        <path d="M12 16V4" />
        <path d="M18 16v-5" />
      </svg>
    );
  }

  if (itemId === "create-reference") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2Z" />
      </svg>
    );
  }

  if (itemId === "ask-ai") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3 1.9 3.9L18 8.8l-3 2.9.7 4.1-3.7-2-3.7 2 .7-4.1-3-2.9 4.1-1.9L12 3Z" />
      </svg>
    );
  }

  if (itemId === "create-dashboard") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
};

type ReportBuilderMenuProps = {
  items?: ReportBuilderMenuItem[];
  activeItemId?: ReportBuilderActionId;
  buttonLabel?: string;
  onItemSelect?: (item: ReportBuilderMenuItem) => void;
};

const menuItemBaseClass = "w-full text-left px-3 py-2 text-sm text-(--theme-text-primary) transition-colors flex items-center gap-2";

export function ReportBuilderMenu({
  items = defaultReportBuilderMenuItems,
  activeItemId,
  buttonLabel = "Create report",
  onItemSelect,
}: ReportBuilderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleItemSelect = (item: ReportBuilderMenuItem) => {
    item.onSelect?.();
    onItemSelect?.(item);
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="create-report-menu"
        className="bg-(--theme-bg-secondary) hover:bg-(--theme-bg-tertiary) text-(--theme-text-primary) font-medium py-1.5 px-3 sm:py-2 sm:px-4 text-sm rounded-md border border-(--theme-border-primary) transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-(--theme-border-secondary)"
      >
        <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        <span>{buttonLabel}</span>
        <svg aria-hidden="true" className="h-4 w-4 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div
          id="create-report-menu"
          role="menu"
          className="absolute right-0 mt-1 w-60 rounded-md border border-(--theme-border-primary) bg-(--theme-bg-primary) shadow-lg z-[70] py-1"
        >
          {items.map((item) => {
            const isActive = activeItemId === item.id;
            const itemClass = `${menuItemBaseClass} ${isActive ? "bg-(--theme-bg-secondary)" : "hover:bg-(--theme-bg-secondary)"}`;

            if (item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  role="menuitem"
                  onClick={() => handleItemSelect(item)}
                  className={itemClass}
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded text-(--theme-text-secondary)">
                    <ReportBuilderItemIcon itemId={item.id} />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => handleItemSelect(item)}
                className={itemClass}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded text-(--theme-text-secondary)">
                  <ReportBuilderItemIcon itemId={item.id} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
