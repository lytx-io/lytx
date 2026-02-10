"use client";
import { type FormEvent, useContext, useEffect, useRef, useState } from "react";
import { AuthContext, signOut } from "@/app/providers/AuthProvider";
import { ThemeToggle } from "./ui/ThemeToggle";
import { Link } from "./ui/Link";

type TeamInfo = {
  id: number;
  name?: string | null;
  external_id?: number | null;
};

const LAST_TEAM_KEY = "lytx_last_team_id";

const getLastTeamFromStorage = (): number | null => {
  try {
    const stored = localStorage.getItem(LAST_TEAM_KEY);
    return stored ? Number.parseInt(stored, 10) : null;
  } catch {
    return null;
  }
};

const saveLastTeamToStorage = (teamId: number): void => {
  try {
    localStorage.setItem(LAST_TEAM_KEY, String(teamId));
  } catch {
    // Ignore storage errors
  }
};

export function Nav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isTeamMenuOpen, setIsTeamMenuOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [createTeamName, setCreateTeamName] = useState("");
  const [createTeamError, setCreateTeamError] = useState("");
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [switchingTeamId, setSwitchingTeamId] = useState<number | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const { data: session, refetch, setCurrentSite } = useContext(AuthContext);
  const user = session?.user as { name?: string | null; email?: string | null; image?: string | null } | undefined;
  const sessionTeamId = session?.team?.id ?? null;
  const rawTeams = (session?.all_teams ?? []) as TeamInfo[];
  const teamMap = new Map<number, TeamInfo>();
  for (const team of rawTeams) {
    if (team?.id != null) teamMap.set(team.id, team);
  }
  if (!teamMap.size && session?.team?.id) {
    teamMap.set(session.team.id, {
      id: session.team.id,
      name: session.team.name,
      external_id: session.team.external_id,
    });
  }
  const teamList = Array.from(teamMap.values()).sort((a, b) => {
    if (a.id === sessionTeamId) return -1;
    if (b.id === sessionTeamId) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });
  const userName = user?.name?.trim() || "";
  const userEmail = user?.email?.trim() || "";
  const userImage = user?.image || "";

  const getInitials = (name: string, email: string) => {
    if (name) {
      const parts = name.split(" ").filter(Boolean);
      const first = parts[0]?.[0] || "";
      const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
      const initials = `${first}${last}` || first;
      return initials.toUpperCase() || "U";
    }

    if (email) {
      const localPart = email.split("@")[0] || "";
      const letters = localPart.replace(/[^a-zA-Z0-9]/g, "");
      return (letters.slice(0, 2) || "U").toUpperCase();
    }

    return "U";
  };

  const userInitials = getInitials(userName, userEmail);
  const resolvedTeamId =
    activeTeamId && teamList.some((team) => team.id === activeTeamId)
      ? activeTeamId
      : sessionTeamId;
  const currentTeam =
    teamList.find((team) => team.id === resolvedTeamId) ?? teamList[0] ?? null;
  const otherTeams = teamList.filter((team) => team.id !== resolvedTeamId);
  const teamButtonBaseClass =
    "flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm text-[var(--theme-text-primary)] transition-colors disabled:cursor-not-allowed disabled:opacity-60";

  const renderTeamButton = (team: TeamInfo, isCurrent: boolean) => {
    const isSwitching = switchingTeamId === team.id;
    return (
      <button
        key={team.id}
        type="button"
        className={`${teamButtonBaseClass} ${isCurrent
          ? "bg-[var(--theme-bg-secondary)]"
          : "hover:text-[var(--color-primary)]"
          }`}
        aria-current={isCurrent ? "true" : undefined}
        onClick={() => handleSwitchTeam(team.id)}
        disabled={switchingTeamId !== null}
      >
        <span className="truncate">{team.name || "Untitled team"}</span>
        {isCurrent ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--color-primary)]"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ) : isSwitching ? (
          <span className="text-[10px] text-[var(--theme-text-secondary)]">Switching</span>
        ) : null}
      </button>
    );
  };

  const openCreateTeamModal = () => {
    setIsCreateTeamOpen(true);
    setCreateTeamError("");
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
    setIsTeamMenuOpen(false);
  };

  const closeCreateTeamModal = () => {
    setIsCreateTeamOpen(false);
    setCreateTeamError("");
    setCreateTeamName("");
  };

  const handleCreateTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreatingTeam) return;
    const trimmedName = createTeamName.trim();
    if (!trimmedName) {
      setCreateTeamError("Team name is required");
      return;
    }
    if (trimmedName.length < 2) {
      setCreateTeamError("Team name must be at least 2 characters");
      return;
    }
    if (trimmedName.length > 80) {
      setCreateTeamError("Team name must be 80 characters or less");
      return;
    }

    setIsCreatingTeam(true);
    setCreateTeamError("");

    try {
      const response = await fetch("/api/team/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; team_id?: number }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to create team");
      }

      closeCreateTeamModal();

      if (data?.team_id) {
        await handleSwitchTeam(data.team_id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create team";
      setCreateTeamError(message);
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleSwitchTeam = async (teamId: number) => {
    if (teamId === resolvedTeamId) {
      setIsUserMenuOpen(false);
      setIsMenuOpen(false);
      setIsTeamMenuOpen(false);
      return;
    }
    if (switchingTeamId) return;

    setSwitchingTeamId(teamId);
    try {
      const response = await fetch("/api/user/update-last-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
          error?: string;
          userSites?: Array<{ site_id: number; name?: string | null; tag_id: string }>;
        }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to switch team");
      }

      setActiveTeamId(teamId);
      saveLastTeamToStorage(teamId);

      await refetch();

      if (!data?.userSites || data.userSites.length === 0) {
        window.location.assign("/dashboard/new-site");
        return;
      }

      const nextSite = data.userSites[0];
      if (nextSite) {
        setCurrentSite({
          name: nextSite.name || "",
          id: nextSite.site_id,
          tag_id: nextSite.tag_id,
        });
        if (
          window.location.pathname === "/dashboard/new-site" ||
          window.location.pathname === "/new-site"
        ) {
          window.location.assign("/dashboard");
          return;
        }
      } else {
        setCurrentSite(null);
      }
    } catch (error) {
      console.error("Error switching team:", error);
    } finally {
      setSwitchingTeamId(null);
      setIsUserMenuOpen(false);
      setIsMenuOpen(false);
      setIsTeamMenuOpen(false);
    }
  };

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (mobileMenuRef.current?.contains(target)) return;
      setIsUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!isUserMenuOpen) setIsTeamMenuOpen(false);
  }, [isUserMenuOpen]);

  const hasReconciledTeam = useRef(false);
  useEffect(() => {
    if (!teamList.length || hasReconciledTeam.current) return;
    const storedTeamId = getLastTeamFromStorage();
    if (storedTeamId && teamList.some((team) => team.id === storedTeamId)) {
      if (storedTeamId !== sessionTeamId) {
        hasReconciledTeam.current = true;
        handleSwitchTeam(storedTeamId);
      } else {
        setActiveTeamId(storedTeamId);
      }
      return;
    }
    if (sessionTeamId) {
      setActiveTeamId(sessionTeamId);
      saveLastTeamToStorage(sessionTeamId);
    }
  }, [sessionTeamId, teamList]);

  return (
    <>
      <nav className="flex justify-between items-center p-4 bg-[var(--theme-bg-primary)] border-b border-[var(--theme-border-primary)]">
        <Link href="/dashboard" className="logo flex items-center gap-2">
          <img src="/logo.png" alt="Lytx logo" className="h-6 w-6" />
          <span className="text-xl font-bold text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors">
            Lytx
          </span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden md:flex items-center gap-4">
          <ul className="flex gap-6">
            <li className="cursor-pointer">
              <Link
                href="/dashboard"
                className="text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Overview
              </Link>
            </li>
            <li className="cursor-pointer">
              <Link
                href="/dashboard/events"
                className="text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Events
              </Link>
            </li>
            <li className="cursor-pointer">
              <Link
                href="/dashboard/explore"
                className="text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Explore
              </Link>
            </li>
          </ul>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-full border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)] p-1 text-[var(--theme-text-primary)] hover:border-[var(--color-primary)] transition-colors"
              aria-label="Open user menu"
              aria-expanded={isUserMenuOpen}
            >
              {userImage ? (
                <img
                  src={userImage}
                  alt={userName ? `${userName} avatar` : "User avatar"}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--theme-border-primary)] bg-[var(--theme-card-bg)] text-xs font-semibold text-[var(--theme-text-primary)]">
                  {userInitials}
                </span>
              )}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-70"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 min-w-[13rem] rounded-md border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)] shadow-lg z-[80]">
                <div className="px-3 py-2 text-xs text-[var(--theme-text-secondary)]">
                  {userName || userEmail || "Signed in"}
                </div>
                {teamList.length > 0 && (
                  <div className="border-t border-[var(--theme-border-primary)] py-1">
                    <div
                      className="relative"
                      onMouseEnter={() => setIsTeamMenuOpen(true)}
                      onMouseLeave={() => setIsTeamMenuOpen(false)}
                    >
                      <span
                        className="absolute right-full top-0 h-full w-3"
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-sm text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                        onClick={() => setIsTeamMenuOpen((open) => !open)}
                        aria-haspopup="menu"
                        aria-expanded={isTeamMenuOpen}
                      >
                        Switch Team
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="opacity-60"
                          aria-hidden="true"
                        >
                          <polyline points="9 6 15 12 9 18"></polyline>
                        </svg>
                      </button>
                      <div
                        className={`absolute right-full top-0 mr-0 w-64 min-w-[16rem] rounded-md border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)] shadow-lg z-[90] ${isTeamMenuOpen ? "block" : "hidden"
                          }`}
                      >
                        <div className="px-3 pt-2 text-[11px] uppercase tracking-wide text-[var(--theme-text-secondary)]">
                          Current team
                        </div>
                        {currentTeam ? renderTeamButton(currentTeam, true) : null}
                        {otherTeams.length > 0 && (
                          <div className="border-t border-[var(--theme-border-primary)] mt-1 pt-1">
                            <div className="px-3 pt-2 text-[11px] uppercase tracking-wide text-[var(--theme-text-secondary)]">
                              Other teams
                            </div>
                            {otherTeams.map((team) => renderTeamButton(team, false))}
                          </div>
                        )}
                        <div className="border-t border-[var(--theme-border-primary)] mt-1 pt-1">
                          <button
                            type="button"
                            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={openCreateTeamModal}
                            disabled={isCreatingTeam || switchingTeamId !== null}
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--theme-border-primary)] text-xs">
                              +
                            </span>
                            Create a team
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <Link
                  href="/dashboard/settings"
                  className="block cursor-pointer px-3 py-2 text-sm text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  Settings
                </Link>
                <div className="flex items-center justify-between px-3 py-2 text-sm text-[var(--theme-text-primary)]">
                  <span>Theme</span>
                  <ThemeToggle />
                </div>
                <button
                  className="w-full cursor-pointer px-3 py-2 text-left text-sm text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    signOut();
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile hamburger button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu dropdown */}
      {isMenuOpen && (
        <div ref={mobileMenuRef} className="md:hidden bg-[var(--theme-bg-primary)] border-b border-[var(--theme-border-primary)] relative z-[80]">
          <ul className="flex flex-col p-4 gap-4">
            <li>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-full border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)] p-2 text-[var(--theme-text-primary)] hover:border-[var(--color-primary)] transition-colors"
                aria-label="Open user menu"
                aria-expanded={isUserMenuOpen}
              >
                <span className="flex items-center gap-2">
                  {userImage ? (
                    <img
                      src={userImage}
                      alt={userName ? `${userName} avatar` : "User avatar"}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--theme-border-primary)] bg-[var(--theme-card-bg)] text-xs font-semibold text-[var(--theme-text-primary)]">
                      {userInitials}
                    </span>
                  )}
                  <span className="text-sm">
                    {userName || userEmail || "Signed in"}
                  </span>
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-70"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {isUserMenuOpen && (
                <div className="mt-2 rounded-md border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)]">
                  {teamList.length > 0 && (
                    <div className="border-b border-[var(--theme-border-primary)]">
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-sm text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                        onClick={() => setIsTeamMenuOpen((open) => !open)}
                        aria-haspopup="menu"
                        aria-expanded={isTeamMenuOpen}
                      >
                        Switch Team
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`opacity-60 transition-transform ${isTeamMenuOpen ? "rotate-180" : ""
                            }`}
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
                      {isTeamMenuOpen && (
                        <div className="pb-2">
                          <div className="px-3 pt-2 text-[11px] uppercase tracking-wide text-[var(--theme-text-secondary)]">
                            Current team
                          </div>
                          {currentTeam ? renderTeamButton(currentTeam, true) : null}
                          {otherTeams.length > 0 && (
                            <div className="border-t border-[var(--theme-border-primary)] mt-1 pt-1">
                              <div className="px-3 pt-2 text-[11px] uppercase tracking-wide text-[var(--theme-text-secondary)]">
                                Other teams
                              </div>
                              {otherTeams.map((team) => renderTeamButton(team, false))}
                            </div>
                          )}
                          <div className="border-t border-[var(--theme-border-primary)] mt-1 pt-1">
                            <button
                              type="button"
                              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={openCreateTeamModal}
                              disabled={isCreatingTeam || switchingTeamId !== null}
                            >
                              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--theme-border-primary)] text-xs">
                                +
                              </span>
                              Create a team
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <Link
                    href="/dashboard/settings"
                    className="block cursor-pointer px-3 py-2 text-sm text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsMenuOpen(false);
                    }}
                  >
                    Settings
                  </Link>
                  <div className="flex items-center justify-between px-3 py-2 text-sm text-[var(--theme-text-primary)]">
                    <span>Theme</span>
                    <ThemeToggle />
                  </div>
                  <button
                    className="w-full cursor-pointer px-3 py-2 text-left text-sm text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsMenuOpen(false);
                      signOut();
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </li>
            <li>
              <Link
                href="/dashboard"
                className="block text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Overview
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/events"
                className="block text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Events
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/explore"
                className="block text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Explore
              </Link>
            </li>
          </ul>
        </div>
      )}
      {isCreateTeamOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4">
          <div className="w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-primary)] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-[22rem]">
                <h2 className="text-lg font-semibold text-[var(--theme-text-primary)]">
                  Create a new team
                </h2>
                <p className="mt-1 text-sm text-[var(--theme-text-secondary)]">
                  Teams are shared spaces for projects, sites, and reports.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-[var(--theme-border-primary)] p-1 text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] transition-colors"
                onClick={closeCreateTeamModal}
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--theme-text-primary)]">
                  Team name
                </label>
                <input
                  value={createTeamName}
                  onChange={(event) => setCreateTeamName(event.target.value)}
                  className="mt-2 w-full rounded-md border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 py-2 text-[var(--theme-text-primary)] focus:border-[var(--theme-border-primary)] focus:outline-none"
                  placeholder="e.g. Lytx Analytics"
                  maxLength={80}
                  autoFocus
                />
              </div>
              {createTeamError ? (
                <p className="text-sm text-red-500">{createTeamError}</p>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-[var(--theme-border-primary)] px-4 py-2 text-sm text-[var(--theme-text-primary)] hover:text-[var(--color-primary)] transition-colors"
                  onClick={closeCreateTeamModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={
                    isCreatingTeam || switchingTeamId !== null || !createTeamName.trim()
                  }
                >
                  {isCreatingTeam ? "Creating..." : "Create team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
