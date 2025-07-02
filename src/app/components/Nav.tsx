"use client";
import { signOut } from "@/app/AuthProvider";
import { ThemeToggle } from "./ui/ThemeToggle";
// import { ClientOnly } from "./ui/ClientOnly";

export function Nav() {
  return (
    <>
      <nav className="flex justify-between items-center p-4 bg-[var(--theme-bg-primary)] border-b border-[var(--theme-border-primary)]">
        <div className="logo">
          <a
            href="/"
            className="text-xl font-bold text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            Lytx
          </a>
        </div>
        <div className="flex items-center gap-4">
          <ul className="flex gap-6">
            <li className="cursor-pointer">
              <a
                href="/"
                className="text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Home
              </a>
            </li>
            <li className="cursor-pointer">
              <a
                href="/dashboard"
                className="text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Dashboard
              </a>
            </li>
            <li className="cursor-pointer">
              <a
                href="/admin/events"
                className="text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Events
              </a>
            </li>
            <li>
              <button
                className="cursor-pointer text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                onClick={signOut}
              >
                Sign Out
              </button>
            </li>
          </ul>
          <ThemeToggle />
        </div>
      </nav>
    </>
  );
}
