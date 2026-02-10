"use client";
import React from "react";
import { useTheme } from "@/app/providers/ThemeProvider";

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme, isInitialized } = useTheme();

  if (!isInitialized) {
    return (
      <div className="p-2 w-9 h-9 rounded-lg bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] animate-pulse">
        <div className="w-5 h-5 bg-[var(--theme-text-secondary)] opacity-30 rounded"></div>
      </div>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-primary)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-secondary)]"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <svg
          className="w-5 h-5 text-[var(--theme-text-primary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5 text-[var(--theme-text-primary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      )}
    </button>
  );
};
