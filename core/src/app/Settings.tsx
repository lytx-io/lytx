"use client";
import { useContext, useRef, useState, useEffect } from "react";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { AlertBanner } from "@/app/components/ui/AlertBanner";
// import { SiteTag } from "@/app/components/SiteTag";
import type { GetTeamMembers, GetTeamSettings } from "@db/d1/teams";
import type { UserRole } from "@db/types";
import { SiteSelector } from "@components/SiteSelector";
// import {Site}
import { AuthContext } from "@/app/providers/AuthProvider";
import { SiteTagInstallCard } from "@/app/components/SiteTagInstallCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  allowed_site_ids?: Array<number | "all">;
}

export type SettingsInitialSession = {
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
  team?: {
    id: number;
    name?: string | null;
    external_id?: number | null;
  } | null;
  role?: UserRole | null;
  timezone?: string | null;
  userSites?: Array<{
    site_id: number;
    name?: string | null;
    domain?: string | null;
    tag_id: string;
    createdAt?: string | Date | null;
  }>;
};

export type SettingsInitialCurrentSite = {
  id: number;
  name: string;
  tag_id: string;
};

export type SettingsInitialSite = {
  site_id: number;
  name: string;
  tag_id: string;
};

type BillingSummary = {
  planName: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  portalAvailable: boolean;
  hasSubscription: boolean;
  usageMode: "metered" | "capped" | "none";
  usageCap: number | null;
  currentPeriodEvents: number | null;
  currentPeriodBillableEvents: number | null;
  projectedInvoiceCents: number | null;
  projectedMaxInvoiceCents: number | null;
};

const USAGE_CAP_MIN = 1_000_000;
const USAGE_CAP_MAX = 50_000_000;
const USAGE_CAP_STEP = 500_000;

function formatUsageNumber(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  return `${(value / 1_000).toFixed(0)}K`;
}


///team/settings
function TeamSettings(props: {
  team_id?: number;
  isSessionLoading: boolean;
  role: UserRole;
  currentUserEmail?: string | null;
  initialData?: Awaited<GetTeamSettings> | null;
  onApiDataLoad?: (data: Awaited<GetTeamSettings>) => void;
}) {
  const queryClient = useQueryClient();
  const [memberSitesMessage, setMemberSitesMessage] = useAlertState();
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const {
    data: apiData,
    // error: queryError,
    isLoading,
    // refetch: refetchData,
  } = useQuery({
    queryKey: ["settingPageData", props.team_id],

    queryFn: async ({ queryKey }) => {
      const [_key, _dataFilters] = queryKey;
      const response = await fetch("/api/team/settings", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      // console.log("We fetched the data", session);

      return response.json() as GetTeamSettings;
    },
    enabled: !props.isSessionLoading && !!props.team_id,
    initialData: props.initialData ?? undefined,
    staleTime: 0,
    gcTime: 0,
  });
  const [memberRoles, setMemberRoles] = useState<Record<string, UserRole>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);

  // Pass team data to parent when available
  useEffect(() => {
    if (apiData && props.onApiDataLoad) {
      props.onApiDataLoad(apiData);
    }
  }, [apiData, props]);

  useEffect(() => {
    if (!apiData) return;

    const nextRoles: Record<string, UserRole> = {};
    for (const member of apiData.members) {
      nextRoles[member.id] = member.role as UserRole;
    }
    setMemberRoles(nextRoles);
  }, [apiData]);

  const saveMemberRole = async (memberId: string, originalRole: UserRole) => {
    const selectedRole = memberRoles[memberId] ?? originalRole;
    if (selectedRole === originalRole) {
      setMemberSitesMessage({
        type: "info",
        text: "No role changes to save.",
      });
      return;
    }

    setSavingMemberId(memberId);
    try {
      const response = await fetch("/api/team/update-member-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: memberId,
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        setMemberSitesMessage({
          type: "error",
          text: `Error updating member role: ${text}`,
        });
        return;
      }

      const updated = (await response.json()) as TeamMember;
      const nextRole = (updated.role as UserRole) ?? selectedRole;
      setMemberRoles((prev) => ({
        ...prev,
        [memberId]: nextRole,
      }));

      if (apiData && props.onApiDataLoad) {
        props.onApiDataLoad({
          ...apiData,
          members: apiData.members.map((member) =>
            member.id === memberId
              ? { ...member, role: nextRole }
              : member,
          ),
        });
      }

      await queryClient.invalidateQueries({
        queryKey: ["settingPageData", props.team_id],
      });

      setMemberSitesMessage({
        type: "success",
        text: "Member role updated.",
      });
    } catch (error) {
      console.error("Error updating member role:", error);
      setMemberSitesMessage({
        type: "error",
        text: "Error updating member role.",
      });
    } finally {
      setSavingMemberId(null);
    }
  };

  if (isLoading || !apiData) {
    return (
      <div className="py-8 text-center text-[var(--theme-text-secondary)]">
        Loading team settings...
      </div>
    );
  }

  const normalizedCurrentUserEmail = props.currentUserEmail?.trim().toLowerCase() ?? null;
  const orderedMembers = [...apiData.members].sort((left, right) => {
    const leftIsCurrent =
      normalizedCurrentUserEmail !== null
      && left.email?.toLowerCase() === normalizedCurrentUserEmail;
    const rightIsCurrent =
      normalizedCurrentUserEmail !== null
      && right.email?.toLowerCase() === normalizedCurrentUserEmail;

    if (leftIsCurrent === rightIsCurrent) return 0;
    return leftIsCurrent ? -1 : 1;
  });

  return (
    <div className="space-y-8">
      {/* Members List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--theme-text-secondary)]">
          Team Members
        </h3>
        {memberSitesMessage ? (
          <AlertBanner
            tone={memberSitesMessage.type}
            message={memberSitesMessage.text}
            onDismiss={() => setMemberSitesMessage(null)}
          />
        ) : null}
        <div className="border border-[var(--theme-border-primary)] rounded-lg divide-y divide-[var(--theme-border-primary)] overflow-hidden bg-[var(--theme-bg-secondary)]/30">
          {orderedMembers.map((member) => {
            const isCurrentUser =
              normalizedCurrentUserEmail !== null
              && member.email?.toLowerCase() === normalizedCurrentUserEmail;

            return (
              <div
                key={member.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-start gap-4 transition-colors ${
                  isCurrentUser
                    ? "bg-amber-500/5"
                    : "hover:bg-[var(--theme-bg-secondary)]/50"
                }`}
              >
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  {isCurrentUser ? (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-400">
                      Your account
                    </div>
                  ) : null}
                  <Input
                    disabled
                    label="Name"
                    type="text"
                    value={member.name!}
                    placeholder="Member name"
                  />
                  <Input
                    disabled
                    label="Email"
                    type="email"
                    value={member.email!}
                    placeholder="Member email"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">
                      Role
                    </label>
                    <select
                      disabled={props.role !== "admin"}
                      value={memberRoles[member.id] ?? (member.role as UserRole)}
                      onChange={(e) => {
                        setMemberRoles((prev) => ({
                          ...prev,
                          [member.id]: e.target.value as UserRole,
                        }));
                      }}
                      className="w-full px-4 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-lg text-[var(--theme-text-primary)] focus:border-[var(--theme-border-primary)] focus:outline-none transition-colors"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">
                      Allowed Sites
                    </label>
                    <select
                      multiple
                      disabled={props.role !== "admin"}
                      value={
                        member.allowed_site_ids &&
                          member.allowed_site_ids.length > 0
                          ? member.allowed_site_ids.map(String)
                          : ["all"]
                      }
                      onChange={async (e) => {
                        let values = Array.from(
                          e.target.selectedOptions,
                          (option) => option.value,
                        );
                        if (values.includes("all") && values.length > 1) {
                          values = values.filter((value) => value !== "all");
                        }

                        const allowed_site_ids = values.includes("all")
                          ? (["all"] as Array<number | "all">)
                          : values
                            .map((value) => parseInt(value, 10))
                            .filter((value) => !Number.isNaN(value));

                        try {
                          const response = await fetch(
                            "/api/team/update-member-sites",
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                user_id: member.id,
                                allowed_site_ids,
                              }),
                            },
                          );

                          if (!response.ok) {
                            const text = await response.text();
                            setMemberSitesMessage({
                              type: "error",
                              text: `Error updating member sites: ${text}`,
                            });
                            return;
                          }

                          const updated = (await response.json()) as TeamMember;
                          if (apiData && props.onApiDataLoad) {
                            props.onApiDataLoad({
                              ...apiData,
                              members: apiData.members.map((m) =>
                                m.id === member.id
                                  ? {
                                    ...m,
                                    allowed_site_ids:
                                      updated.allowed_site_ids ?? ["all"],
                                  }
                                  : m,
                              ),
                            });
                          }
                          setMemberSitesMessage({
                            type: "success",
                            text: "Member site access updated.",
                          });
                        } catch (error) {
                          console.error("Error updating member sites:", error);
                          setMemberSitesMessage({
                            type: "error",
                            text: "Error updating member sites.",
                          });
                        }
                      }}
                      className="w-full px-4 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-lg text-[var(--theme-text-primary)] focus:border-[var(--theme-border-primary)] focus:outline-none min-h-[100px] transition-colors"
                    >
                      <option value="all">All sites</option>
                      {apiData.sites?.map((site) => (
                        <option
                          key={site.site_id}
                          value={site.site_id.toString()}
                        >
                          {site.name || site.domain || `Site ${site.site_id}`}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-[var(--theme-text-secondary)] mt-1.5">
                      Hold Ctrl/Cmd to select multiple sites
                    </p>
                  </div>
                </div>
              </div>

              {props.role === "admin" && (
                <div className="flex sm:flex-col gap-2 pt-1 sm:pt-7">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      void saveMemberRole(member.id, member.role as UserRole);
                    }}
                    disabled={savingMemberId === member.id}
                  >
                    {savingMemberId === member.id ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={isCurrentUser}
                    title={isCurrentUser ? "You cannot remove your own account from this view." : undefined}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>

      {/* API Keys List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--theme-text-secondary)]">
          API Keys
        </h3>
        <div className="border border-[var(--theme-border-primary)] rounded-lg divide-y divide-[var(--theme-border-primary)] overflow-hidden bg-[var(--theme-bg-secondary)]/30">
          {apiData.keys.map((key) => (
            <div
              key={key.id}
              className="p-4 flex items-center justify-between hover:bg-[var(--theme-bg-secondary)]/50 transition-colors"
            >
              <div className="space-y-1">
                {(() => {
                  const linkedSite =
                    typeof key.site_id === "number"
                      ? apiData.sites?.find((site) => site.site_id === key.site_id)
                      : null;
                  const siteLabel = linkedSite
                    ? linkedSite.name || linkedSite.domain || `Site ${linkedSite.site_id}`
                    : typeof key.site_id === "number"
                      ? `Site ${key.site_id}`
                      : "No site assigned";

                  return (
                    <div className="text-xs text-[var(--theme-text-secondary)]">
                      <span className="font-medium">Site:</span> {siteLabel}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-3">
                  <code className="px-2 py-1 bg-[var(--theme-input-bg)] border border-[var(--theme-border-primary)] rounded text-sm font-mono text-[var(--theme-text-primary)]">
                    {key.key}
                  </code>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (key.key) {
                          navigator.clipboard.writeText(key.key);
                          setCopiedKeyId(key.id);
                          setTimeout(() => setCopiedKeyId(null), 2000);
                        }
                      }}
                      className={`p-1.5 rounded-md transition-all duration-200 ${copiedKeyId === key.id
                        ? "bg-green-100 text-green-600"
                        : "text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-secondary)]"
                        }`}
                      title="Copy API key"
                    >
                      {copiedKeyId === key.id ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            width="14"
                            height="14"
                            x="8"
                            y="8"
                            rx="2"
                            ry="2"
                          />
                          <path d="m4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                      )}
                    </button>
                    {copiedKeyId === key.id && (
                      <span className="text-xs text-green-600 font-medium animate-fade-in">
                        Copied
                      </span>
                    )}
                  </div>
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <div className="text-sm text-[var(--theme-text-secondary)]">
                  <span className="font-medium">Permissions:</span>{" "}
                  {key.permissions.read && !key.permissions.write
                    ? "Read Only"
                    : "Read & Write"}
                </div>
              </div>
            </div>
          ))}
          {apiData.keys.length === 0 && (
            <div className="p-8 text-center text-[var(--theme-text-secondary)]">
              No API keys created yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBillingStatus(status?: string | null) {
  if (!status) return "Active";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatBillingAmount(amount?: number | null, currency?: string | null) {
  if (typeof amount !== "number") return null;
  const currencyCode = currency?.trim().toUpperCase() || "USD";
  const locale = currencyCode === "USD" ? "en-US" : undefined;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    const normalizedAmount = (amount / 100).toFixed(2);
    return currencyCode === "USD"
      ? `$${normalizedAmount}`
      : `${currencyCode} ${normalizedAmount}`;
  }
}

function useAutoDismiss<T>(
  value: T | null,
  setValue: (next: T | null) => void,
  delay = 5000,
) {
  useEffect(() => {
    if (!value) return;
    const handle = window.setTimeout(() => {
      setValue(null);
    }, delay);

    return () => {
      window.clearTimeout(handle);
    };
  }, [value, delay, setValue]);
}

function useAlertState() {
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  useAutoDismiss(alert, setAlert);
  return [alert, setAlert] as const;
}

function BillingSection(props: {
  teamId?: number;
  isSessionLoading: boolean;
  canManage: boolean;
  initialSummary?: BillingSummary | null;
}) {
  const queryClient = useQueryClient();
  const [portalError, setPortalError] = useState<string | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [isStartingSubscription, setIsStartingSubscription] = useState(false);
  const [capEnabled, setCapEnabled] = useState(false);
  const [capEvents, setCapEvents] = useState(5_000_000);
  const [capDirty, setCapDirty] = useState(false);
  const [capError, setCapError] = useState<string | null>(null);
  const [capWarning, setCapWarning] = useState<string | null>(null);
  const [isSavingCap, setIsSavingCap] = useState(false);

  useAutoDismiss(portalError, setPortalError);
  useAutoDismiss(subscribeError, setSubscribeError);
  useAutoDismiss(capError, setCapError);
  useAutoDismiss(capWarning, setCapWarning);

  const {
    data: billingSummary,
    isLoading: isBillingLoading,
    error: billingError,
  } = useQuery({
    queryKey: ["billingSummary", props.teamId],
    queryFn: async () => {
      const response = await fetch("/api/billing/summary", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || response.statusText || "Failed to load billing");
      }

      const data = (await response.json()) as BillingSummary;
      return data;
    },
    enabled: !props.isSessionLoading && !!props.teamId,
    initialData: props.initialSummary ?? undefined,
    staleTime: 0,
    gcTime: 0,
  });

  const hasSubscription = Boolean(billingSummary?.hasSubscription);
  const planName = hasSubscription
    ? billingSummary?.planName ?? "Paid plan"
    : "Subscription required";
  const statusLabel = hasSubscription
    ? formatBillingStatus(billingSummary?.status)
    : "Not subscribed";
  const amountLabel = formatBillingAmount(billingSummary?.amount, billingSummary?.currency);
  const intervalLabel = billingSummary?.interval ? `/${billingSummary.interval}` : "";
  const renewalLabel = billingSummary?.currentPeriodEnd
    ? new Date(billingSummary.currentPeriodEnd).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    : "—";
  const portalAvailable = Boolean(billingSummary?.portalAvailable);
  const billingErrorMessage = billingError instanceof Error
    ? billingError.message
    : "Failed to load billing";
  const showStartSubscription = props.canManage && !hasSubscription;
  const storedCapEnabled = Boolean(
    billingSummary?.usageMode === "capped" && typeof billingSummary?.usageCap === "number",
  );
  const storedCap = billingSummary?.usageCap ?? 5_000_000;
  const capHasChanges = capEnabled !== storedCapEnabled || (capEnabled && capEvents !== storedCap);
  const projectionCurrency = billingSummary?.currency ?? "usd";
  const currencyCode = projectionCurrency.toUpperCase();
  const currencyHint = currencyCode === "USD"
    ? "All billing amounts are shown in $ USD."
    : `All billing amounts are shown in ${currencyCode}.`;
  const projectedInvoiceLabel =
    typeof billingSummary?.projectedInvoiceCents === "number"
      ? formatBillingAmount(billingSummary.projectedInvoiceCents, projectionCurrency)
      : null;
  const projectedMaxInvoiceLabel =
    typeof billingSummary?.projectedMaxInvoiceCents === "number"
      ? formatBillingAmount(billingSummary.projectedMaxInvoiceCents, projectionCurrency)
      : null;
  const observedEvents = billingSummary?.currentPeriodEvents;
  const billableEvents = billingSummary?.currentPeriodBillableEvents;
  const hasCapActive = billingSummary?.usageMode === "capped" && typeof billingSummary?.usageCap === "number";
  const capReached =
    hasCapActive
    && typeof observedEvents === "number"
    && typeof billableEvents === "number"
    && observedEvents > billableEvents;

  useEffect(() => {
    if (!billingSummary || capDirty) return;
    setCapEnabled(storedCapEnabled);
    setCapEvents(storedCap);
  }, [billingSummary, capDirty, storedCapEnabled, storedCap]);

  async function handleManageBilling() {
    setPortalError(null);
    setIsOpeningPortal(true);

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || response.statusText || "Failed to open billing portal");
      }

      const data = (await response.json()) as { url?: string };
      if (!data.url) {
        throw new Error("Billing portal unavailable");
      }

      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open billing portal";
      setPortalError(message);
    } finally {
      setIsOpeningPortal(false);
    }
  }

  async function handleStartSubscription() {
    setSubscribeError(null);
    setIsStartingSubscription(true);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || response.statusText || "Failed to start checkout");
      }

      const data = (await response.json()) as { url?: string };
      if (!data.url) {
        throw new Error("Stripe checkout unavailable");
      }

      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start checkout";
      setSubscribeError(message);
    } finally {
      setIsStartingSubscription(false);
    }
  }

  async function handleSaveUsageCap() {
    setCapError(null);
    setCapWarning(null);
    setIsSavingCap(true);

    try {
      const response = await fetch("/api/billing/usage-cap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capEnabled,
          usageCap: capEvents,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || response.statusText || "Failed to update usage cap");
      }

      const data = (await response.json()) as {
        usageMode?: "metered" | "capped" | "none";
        usageCap?: number | null;
        warning?: string | null;
      };

      setCapEnabled(data.usageMode === "capped");
      if (typeof data.usageCap === "number") {
        setCapEvents(data.usageCap);
      }
      setCapDirty(false);
      setCapWarning(data.warning ?? null);
      await queryClient.invalidateQueries({ queryKey: ["billingSummary", props.teamId] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update usage cap";
      setCapError(message);
    } finally {
      setIsSavingCap(false);
    }
  }

  return (
    <div id="billing">
      <Card className="p-4 sm:p-6">
      <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h2 className="text-xl font-semibold text-[var(--theme-text-primary)]">
              Billing
            </h2>
            {hasSubscription ? (
              <span className="inline-flex items-center rounded-full border border-emerald-500/60 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                Billing active
              </span>
            ) : null}
          </div>
          <p className="text-sm text-[var(--theme-text-secondary)]">
            View your current plan and manage billing in Stripe.
          </p>
        </div>
        {props.canManage ? (
          <div className="flex flex-wrap gap-2">
            {showStartSubscription ? (
              <Button
                variant="primary"
                onClick={handleStartSubscription}
                disabled={isStartingSubscription || isBillingLoading}
              >
                {isStartingSubscription ? "Starting…" : "Start subscription"}
              </Button>
            ) : null}
            <Button
              variant={showStartSubscription ? "secondary" : "primary"}
              onClick={handleManageBilling}
              disabled={isOpeningPortal || isBillingLoading || !portalAvailable}
            >
              {isOpeningPortal ? "Opening…" : "Manage billing"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--theme-text-secondary)]">
            Current plan
          </p>
          <p className="text-lg font-semibold text-[var(--theme-text-primary)] mt-2">
            {isBillingLoading ? "Loading..." : planName}
          </p>
          <p className="text-sm text-[var(--theme-text-secondary)] mt-1">
            {isBillingLoading
              ? "—"
              : amountLabel
                ? `${amountLabel}${intervalLabel}`
                : hasSubscription
                  ? "Contact support for pricing"
                  : "Complete checkout to activate"}
          </p>
        </div>

        <div className="rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--theme-text-secondary)]">
            Status
          </p>
          <p className="text-lg font-semibold text-[var(--theme-text-primary)] mt-2">
            {isBillingLoading ? "Loading..." : statusLabel}
          </p>
          <p className="text-sm text-[var(--theme-text-secondary)] mt-1">
            {isBillingLoading
              ? "Checking Stripe"
              : portalAvailable
                ? "Stripe linked"
                : "Stripe not linked"}
          </p>
        </div>

        <div className="rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--theme-text-secondary)]">
            Renewal date
          </p>
          <p className="text-lg font-semibold text-[var(--theme-text-primary)] mt-2">
            {isBillingLoading ? "Loading..." : renewalLabel}
          </p>
          <p className="text-sm text-[var(--theme-text-secondary)] mt-1">
            Manage payment methods in Stripe
          </p>
        </div>
      </div>

      <p className="text-xs text-[var(--theme-text-secondary)]">
        {currencyHint}
      </p>

      <div className="mt-6 rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)]/30 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--theme-text-primary)]">
              Usage cap
            </p>
            <p className="text-xs text-[var(--theme-text-secondary)]">
              Stop Stripe billing after a monthly event limit. Lytx continues ingesting events.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-[var(--theme-text-primary)]">
            <input
              type="checkbox"
              checked={capEnabled}
              onChange={(event) => {
                setCapEnabled(event.target.checked);
                setCapDirty(true);
              }}
              disabled={!props.canManage || isBillingLoading}
              className="h-4 w-4"
            />
            Enable cap
          </label>
        </div>

        <div className={`mt-4 ${capEnabled ? "" : "opacity-60 pointer-events-none"}`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-[var(--theme-text-secondary)]">Monthly cap</span>
            <span className="text-sm font-semibold text-[var(--theme-text-primary)]">
              {formatUsageNumber(capEvents)} events
            </span>
          </div>
          <input
            type="range"
            min={USAGE_CAP_MIN}
            max={USAGE_CAP_MAX}
            step={USAGE_CAP_STEP}
            value={capEvents}
            onChange={(event) => {
              setCapEvents(Number(event.target.value));
              setCapDirty(true);
            }}
            className="w-full h-2 rounded-lg bg-[var(--theme-input-bg)] accent-[var(--theme-text-primary)]"
          />
          <div className="flex justify-between text-xs text-[var(--theme-text-secondary)] mt-1">
            <span>{formatUsageNumber(USAGE_CAP_MIN)}</span>
            <span>{formatUsageNumber(USAGE_CAP_MAX)}+</span>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs text-[var(--theme-text-secondary)]">
              {projectedInvoiceLabel && typeof observedEvents === "number"
                ? `Projected this period: ${projectedInvoiceLabel} (${observedEvents.toLocaleString()} observed events${typeof billableEvents === "number" ? `, ${billableEvents.toLocaleString()} billable` : ""}).`
                : "Projected this period: unavailable until current period usage is loaded."}
            </p>
            {projectedMaxInvoiceLabel ? (
              <p className="text-xs text-[var(--theme-text-secondary)]">
                {`Max with cap: ${projectedMaxInvoiceLabel} this month${capReached ? " (cap reached)" : ""}.`}
              </p>
            ) : null}
            <p className="text-xs text-[var(--theme-text-secondary)]">
              {capEnabled
                ? "Billing stops at the cap until next period."
                : "No cap applied; billing is based on actual usage."}
            </p>
            <p
              className="text-xs text-[var(--theme-text-secondary)]"
              title="Observed events are total ingested events this period. Billable events are the portion Stripe bills after applying your billing mode and usage cap."
            >
              Observed events are ingested volume; billable events are what Stripe charges after cap rules.
            </p>
          </div>
          {props.canManage ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveUsageCap}
              disabled={isSavingCap || isBillingLoading || !capHasChanges}
            >
              {isSavingCap ? "Saving…" : "Save cap"}
            </Button>
          ) : null}
        </div>
      </div>

      {billingError ? (
        <p className="text-sm text-red-500 mt-3">{billingErrorMessage}</p>
      ) : null}
      {portalError ? (
        <p className="text-sm text-red-500 mt-2">{portalError}</p>
      ) : null}
      {subscribeError ? (
        <p className="text-sm text-red-500 mt-2">{subscribeError}</p>
      ) : null}
      {capError ? (
        <p className="text-sm text-red-500 mt-2">{capError}</p>
      ) : null}
      {capWarning ? (
        <p className="text-sm text-amber-500 mt-2">{capWarning}</p>
      ) : null}
      </div>
      </Card>
    </div>
  );
}

type SettingsPageProps = {
  initialSession?: SettingsInitialSession | null;
  initialCurrentSite?: SettingsInitialCurrentSite | null;
  initialSites?: SettingsInitialSite[];
  initialTeamSettings?: Awaited<GetTeamSettings> | null;
  initialBillingSummary?: BillingSummary | null;
};

export function SettingsPage({
  initialSession = null,
  initialCurrentSite = null,
  initialSites = [],
  initialTeamSettings = null,
  initialBillingSummary = null,
}: SettingsPageProps) {
  const auth = useContext(AuthContext) || null;
  const authSession = auth?.data ?? null;
  const session = authSession ?? initialSession;
  const currentUserEmail =
    ((authSession as any)?.user?.email as string | undefined)
    ?? ((authSession as any)?.email as string | undefined)
    ?? initialSession?.user?.email
    ?? null;
  const sessionTeamName = authSession?.team?.name ?? initialSession?.team?.name ?? null;
  const sessionTimezone = authSession?.timezone ?? initialSession?.timezone ?? null;
  const isSessionLoading = (auth?.isPending ?? false) && !initialSession;
  const current_site = auth?.current_site ?? initialCurrentSite;
  const refetch = auth?.refetch ?? (async () => undefined);
  const initialSiteId = initialCurrentSite?.id ?? initialSites[0]?.site_id ?? null;
  const [teamName, setTeamName] = useState(() => sessionTeamName ?? "");
  const [teamNameMessage, setTeamNameMessage] = useAlertState();
  const [apiKeyMessage, setApiKeyMessage] = useAlertState();
  const [memberMessage, setMemberMessage] = useAlertState();
  const [siteMessage, setSiteMessage] = useAlertState();
  // Add member form state
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [newMemberData, setNewMemberData] = useState({
    email: "",
    name: "",
    role: "editor" as UserRole,
  });
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [showAddApiKeyForm, setShowAddApiKeyForm] = useState(false);
  const [newApiKeyData, setNewApiKeyData] = useState({
    permissions: { read: true, write: false },
    allowed_team_members: ["all"] as string[]
  });
  const [isAddingApiKey, setIsAddingApiKey] = useState(false);
  const [teamMembersData, setTeamMembersData] = useState<Awaited<GetTeamSettings> | null>(initialTeamSettings);
  const [checkoutMessage, setCheckoutMessage] = useState<null | {
    type: "success" | "error";
    text: string;
  }>(null);

  useEffect(() => {
    if (!isSessionLoading && sessionTeamName) {
      setTeamName(sessionTeamName);
    } else if (!isSessionLoading) {
      setTeamName("");
    }
  }, [isSessionLoading, session?.team?.id, sessionTeamName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const checkoutStatus = url.searchParams.get("checkout");
    if (!checkoutStatus) return;

    if (checkoutStatus === "success") {
      setCheckoutMessage({
        type: "success",
        text: "Subscription started. Stripe will confirm your billing details shortly.",
      });
    } else if (checkoutStatus === "cancel") {
      setCheckoutMessage({
        type: "error",
        text: "Checkout canceled. Your subscription was not started.",
      });
    }

    url.searchParams.delete("checkout");
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Add site form state
  const [showAddSiteForm, setShowAddSiteForm] = useState(false);
  const [newSiteData, setNewSiteData] = useState({
    name: "",
    domain: "",
    track_web_events: true,
    gdpr: false,
    autocapture: true,
    event_load_strategy: "sdk" as "sdk" | "kv",
  });
  const [isAddingSite, setIsAddingSite] = useState(false);

  // User timezone state
  const [userTimezone, setUserTimezone] = useState<string>(() => sessionTimezone ?? "");
  const [isUpdatingTimezone, setIsUpdatingTimezone] = useState(false);
  const [timezoneMessage, setTimezoneMessage] = useAlertState();

  // Initialize timezone from session, or default to browser timezone for display
  useEffect(() => {
    if (isSessionLoading) return;

    if (sessionTimezone) {
      setUserTimezone(sessionTimezone);
      return;
    }

    // Pre-fill with browser timezone as a suggested default
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(browserTimezone);
  }, [isSessionLoading, sessionTimezone]);

  async function handleUpdateTimezone() {
    if (!userTimezone) return;

    setIsUpdatingTimezone(true);
    setTimezoneMessage(null);

    try {
      const response = await fetch("/api/user/update-timezone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: userTimezone }),
      });

      if (response.ok) {
        setTimezoneMessage({ type: "success", text: "Timezone updated successfully" });
        // Refetch session to get updated timezone
        refetch();
      } else {
        const data = await response.json().catch(() => ({})) as { error?: string };
        setTimezoneMessage({ type: "error", text: data.error || "Failed to update timezone" });
      }
    } catch (error) {
      console.error("Error updating timezone:", error);
      setTimezoneMessage({ type: "error", text: "Failed to update timezone" });
    } finally {
      setIsUpdatingTimezone(false);
    }
  }


  const currentTeamName = (!isSessionLoading && session?.team?.name) || "";
  async function updateTeamName(
    _e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) {
    const nextName = teamName.trim();
    if (!nextName) return;
    if (import.meta.env.DEV) console.log(currentTeamName);
    if (currentTeamName === nextName) return;
    if (import.meta.env.DEV) console.log(nextName, currentTeamName);
    setTeamNameMessage(null);

    const response = await fetch("/api/team/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        option: "name",
        name: nextName,
      }),
    });
    if (response.ok) {
      setTeamNameMessage({ type: "success", text: "Team name updated." });
      setTeamName(nextName);
      refetch();
    } else {
      setTeamNameMessage({ type: "error", text: "Error updating team name." });
    }
  }

  async function handleAddApiKey() {
    if (!newApiKeyData.permissions.read && !newApiKeyData.permissions.write) {
      setApiKeyMessage({ type: "error", text: "Please select at least one permission." });
      return;
    }

    if (!current_site?.id) {
      setApiKeyMessage({ type: "error", text: "Please select a site before creating an API key." });
      return;
    }

    setIsAddingApiKey(true);
    try {

      const response = await fetch("/api/team/add-api-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          site_id: current_site.id,
          permissions: newApiKeyData.permissions,
          allowed_team_members: newApiKeyData.allowed_team_members,
        }),
      });

      if (response.ok) {
        setApiKeyMessage({ type: "success", text: "Team API key added." });
        setNewApiKeyData({ permissions: { read: true, write: false }, allowed_team_members: ["all"] as string[] });
        setShowAddApiKeyForm(false);
        refetch();
      } else {
        const errorText = await response.text();
        setApiKeyMessage({ type: "error", text: `Error adding team API key: ${errorText}` });
      }
    } catch (error) {
      console.error("Error adding team API key:", error);
      setApiKeyMessage({ type: "error", text: "Error adding team API key." });
    } finally {
      setIsAddingApiKey(false);
    }
  }

  async function handleAddMember() {
    if (!newMemberData.email.trim() || !newMemberData.name.trim()) {
      setMemberMessage({ type: "error", text: "Please enter both name and email address." });
      return;
    }

    setIsAddingMember(true);
    try {
      const response = await fetch("/api/team/add-member", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newMemberData.email,
          name: newMemberData.name,
          role: newMemberData.role,
        }),
      });

      if (response.ok) {
        setMemberMessage({ type: "success", text: "Team member added." });
        setNewMemberData({ email: "", name: "", role: "editor" as UserRole });
        setShowAddMemberForm(false);
        refetch();
      } else {
        const errorText = await response.text();
        setMemberMessage({ type: "error", text: `Error adding team member: ${errorText}` });
      }
    } catch (error) {
      console.error("Error adding team member:", error);
      setMemberMessage({ type: "error", text: "Error adding team member." });
    } finally {
      setIsAddingMember(false);
    }
  }

  async function handleAddSite() {
    if (!newSiteData.name.trim() || !newSiteData.domain.trim()) {
      setSiteMessage({ type: "error", text: "Please enter both site name and domain." });
      return;
    }

    setIsAddingSite(true);
    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newSiteData),
      });

      if (response.ok) {
        // const newSite = await response.json();
        setSiteMessage({ type: "success", text: "Site added." });
        setNewSiteData({
          name: "",
          domain: "",
          track_web_events: true,
          gdpr: false,
          autocapture: true,
          event_load_strategy: "sdk",
        });
        setShowAddSiteForm(false);
        refetch();
      } else {
        const errorText = await response.text();
        setSiteMessage({ type: "error", text: `Error adding site: ${errorText}` });
      }
    } catch (error) {
      console.error("Error adding site:", error);
      setSiteMessage({ type: "error", text: "Error adding site." });
    } finally {
      setIsAddingSite(false);
    }
  }

  // Get current site tag data
  const currentSiteTag =
    !isSessionLoading && session && current_site && session.userSites
      ? session.userSites.find((site) => site.site_id === current_site.id)
      : null;
  return (
    <div className="bg-[var(--theme-bg-primary)] min-h-screen px-4 py-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-[var(--theme-text-primary)] mb-8">
          Settings
        </h1>
        {checkoutMessage ? (
          <div
            className={`rounded-lg border px-4 py-3 text-sm font-medium ${checkoutMessage.type === "success"
              ? "border-green-500/60 bg-green-500/10 text-green-600"
              : "border-red-500/60 bg-red-500/10 text-red-500"
              }`}
          >
            {checkoutMessage.text}
          </div>
        ) : null}

        {/* User Profile Section */}
        <Card className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-[var(--theme-text-primary)] mb-4">
            Your Profile
          </h2>
          <div className="space-y-4">
            {/* User Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                disabled
                value={session?.user?.name || ""}
                label="Name"
              />
              <Input
                type="email"
                disabled
                value={session?.user?.email || ""}
                label="Email"
              />
            </div>

            {/* Timezone Selector */}
            <div>
              <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">
                Default Timezone
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <select
                  value={userTimezone}
                  onChange={(e) => setUserTimezone(e.target.value)}
                  className="w-full min-w-0 px-4 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-lg text-[var(--theme-text-primary)] focus:border-[var(--theme-border-primary)] focus:outline-none transition-colors sm:flex-1"
                >
                  <option value="">Select timezone...</option>
                  {Intl.supportedValuesOf("timeZone").map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleUpdateTimezone}
                  variant="primary"
                  disabled={isUpdatingTimezone || !userTimezone}
                  className="w-full sm:w-auto sm:shrink-0"
                >
                  {isUpdatingTimezone ? "Saving..." : "Save"}
                </Button>
              </div>
              <p className="text-xs text-[var(--theme-text-secondary)] mt-1">
                This timezone will be used for displaying dates and times in the dashboard.
              </p>
              {timezoneMessage && (
                <p
                  className={`text-sm mt-2 ${timezoneMessage.type === "success"
                    ? "text-green-600"
                    : "text-red-500"
                    }`}
                >
                  {timezoneMessage.text}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Team Name Section */}
        <Card className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-[var(--theme-text-primary)] mb-4">
            Team Name
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Input
              type="text"
              disabled={session?.role === "admin" ? false : true}
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              className="w-full sm:flex-1"
              placeholder="Enter team name"
            />
            {session?.role === "admin" ? (
              <Button
                onClick={async (e) => await updateTeamName(e)}
                variant="primary"
                className="w-full sm:w-auto"
              >
                Save
              </Button>
            ) : null}
          </div>
          {teamNameMessage ? (
            <div className="mt-3">
              <AlertBanner
                tone={teamNameMessage.type}
                message={teamNameMessage.text}
                onDismiss={() => setTeamNameMessage(null)}
              />
            </div>
          ) : null}
        </Card>

        <BillingSection
          teamId={session?.team?.id}
          isSessionLoading={isSessionLoading}
          canManage={session?.role === "admin"}
          initialSummary={initialBillingSummary}
        />

        {/* Team Settings Section */}
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[var(--theme-text-primary)]">
              Team Settings
            </h2>
            {session && session.role === "admin" ? (
              <div className="space-x-2">
                <Button
                  variant={showAddMemberForm ? "secondary" : "primary"}
                  onClick={() => setShowAddMemberForm(!showAddMemberForm)}
                >
                  {showAddMemberForm ? "Cancel" : "Add Member"}
                </Button>
                <Button
                  variant={showAddApiKeyForm ? "secondary" : "primary"}
                  onClick={() => setShowAddApiKeyForm(!showAddApiKeyForm)}
                >
                  {showAddApiKeyForm ? "Cancel" : "Add API Key"}
                </Button>
              </div>
            ) : null}
          </div>

          {/* Add Member Form */}
          {showAddMemberForm && (
            <div className="mb-4 p-4 bg-[var(--theme-bg-secondary)] rounded-lg border border-[var(--theme-border-primary)]">
              <h3 className="text-lg font-medium text-[var(--theme-text-primary)] mb-3">
                Add Team Member
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    type="text"
                    value={newMemberData.name}
                    onChange={(e) =>
                      setNewMemberData({
                        ...newMemberData,
                        name: e.target.value,
                      })
                    }
                    placeholder="Member name"
                  />
                  <Input
                    type="email"
                    value={newMemberData.email}
                    onChange={(e) =>
                      setNewMemberData({
                        ...newMemberData,
                        email: e.target.value,
                      })
                    }
                    placeholder="Member email"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">
                    Role
                  </label>
                  <select
                    value={newMemberData.role}
                    onChange={(e) =>
                      setNewMemberData({
                        ...newMemberData,
                        role: e.target.value as UserRole,
                      })
                    }
                    className="w-full px-4 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-lg text-[var(--theme-text-primary)] focus:border-[var(--theme-border-primary)] focus:outline-none transition-colors"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    onClick={handleAddMember}
                    disabled={isAddingMember}
                  >
                    {isAddingMember ? "Adding..." : "Add Member"}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {memberMessage ? (
            <div className="mb-4">
              <AlertBanner
                tone={memberMessage.type}
                message={memberMessage.text}
                onDismiss={() => setMemberMessage(null)}
              />
            </div>
          ) : null}

          {/* Add API Key Form */}
          {showAddApiKeyForm && (
            <div className="mb-4 p-4 bg-[var(--theme-bg-secondary)] rounded-lg border border-[var(--theme-border-primary)]">
              <h3 className="text-lg font-medium text-[var(--theme-text-primary)] mb-3">
                Add API Key
              </h3>
              <div className="space-y-4">
                {/* Permissions */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">
                    Permissions
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="permissions"
                        checked={newApiKeyData.permissions.read && !newApiKeyData.permissions.write}
                        onChange={() =>
                          setNewApiKeyData({
                            ...newApiKeyData,
                            permissions: { read: true, write: false },
                          })
                        }
                        className="text-blue-600"
                      />
                      <span className="text-sm text-[var(--theme-text-primary)]">
                        Read Only
                      </span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="permissions"
                        checked={newApiKeyData.permissions.read && newApiKeyData.permissions.write}
                        onChange={() =>
                          setNewApiKeyData({
                            ...newApiKeyData,
                            permissions: { read: true, write: true },
                          })
                        }
                        className="text-blue-600"
                      />
                      <span className="text-sm text-[var(--theme-text-primary)]">
                        Read & Write
                      </span>
                    </label>
                  </div>
                </div>

                {/* Team Member Access */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">
                    Allowed Team Members
                  </label>
                  <select
                    multiple
                    value={newApiKeyData.allowed_team_members}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, option => option.value);
                      setNewApiKeyData({
                        ...newApiKeyData,
                        allowed_team_members: values,
                      });
                    }}
                    className="w-full px-4 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-lg text-[var(--theme-text-primary)] focus:border-[var(--theme-border-primary)] focus:outline-none min-h-[100px] transition-colors"
                  >
                    <option value="all">All Team Members</option>
                    {teamMembersData?.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.email})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[var(--theme-text-secondary)] mt-1">
                    Hold Ctrl/Cmd to select multiple members
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    onClick={handleAddApiKey}
                    disabled={isAddingApiKey}
                  >
                    {isAddingApiKey ? "Adding..." : "Add API Key"}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {apiKeyMessage ? (
            <div className="mb-4">
              <AlertBanner
                tone={apiKeyMessage.type}
                message={apiKeyMessage.text}
                onDismiss={() => setApiKeyMessage(null)}
              />
            </div>
          ) : null}

          <div className="space-y-3">
            {!isSessionLoading && session ? (
              <TeamSettings
                team_id={session.team?.id}
                role={session.role as UserRole}
                currentUserEmail={currentUserEmail}
                isSessionLoading={isSessionLoading}
                initialData={initialTeamSettings}
                onApiDataLoad={setTeamMembersData}
              />
            ) : (
              <div className="hidden items-center justify-center h-full">
                <p className="text-[var(--theme-text-secondary)]">
                  Loading team members...
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Site Tags Section */}
        <Card className="p-4 sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-[var(--theme-text-primary)]">
              Site Tag
            </h2>
            {session && session.role === "admin" ? (
              <Button
                variant={showAddSiteForm ? "secondary" : "primary"}
                onClick={() => setShowAddSiteForm(!showAddSiteForm)}
                className="w-full sm:w-auto"
              >
                {showAddSiteForm ? "Cancel" : "Add New Site"}
              </Button>
            ) : null}
          </div>

          {/* Add Site Form */}
          {showAddSiteForm && (
            <div className="mb-6 p-4 bg-[var(--theme-bg-secondary)] rounded-lg border border-[var(--theme-border-primary)]">
              <h3 className="text-lg font-medium text-[var(--theme-text-primary)] mb-3">
                Add New Site
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    type="text"
                    value={newSiteData.name}
                    onChange={(e) =>
                      setNewSiteData({ ...newSiteData, name: e.target.value })
                    }
                    placeholder="Site name"
                  />
                  <Input
                    type="text"
                    value={newSiteData.domain}
                    onChange={(e) =>
                      setNewSiteData({ ...newSiteData, domain: e.target.value })
                    }
                    placeholder="Domain (e.g., example.com)"
                  />
                </div>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newSiteData.track_web_events}
                      onChange={(e) =>
                        setNewSiteData({
                          ...newSiteData,
                          track_web_events: e.target.checked,
                        })
                      }
                      className="rounded border-[var(--theme-border-primary)]"
                    />
                    <span className="text-sm text-[var(--theme-text-primary)]">
                      Track web events
                    </span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newSiteData.event_load_strategy === "kv"}
                      onChange={(e) =>
                        setNewSiteData({
                          ...newSiteData,
                          event_load_strategy: e.target.checked ? "kv" : "sdk",
                        })
                      }
                      className="rounded border-[var(--theme-border-primary)]"
                    />
                    <span className="text-sm text-[var(--theme-text-primary)]">
                      Load events from KV
                    </span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newSiteData.gdpr}
                      onChange={(e) =>
                        setNewSiteData({
                          ...newSiteData,
                          gdpr: e.target.checked,
                        })
                      }
                      className="rounded border-[var(--theme-border-primary)]"
                    />
                    <span className="text-sm text-[var(--theme-text-primary)]">
                      GDPR compliant
                    </span>
                  </label>
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newSiteData.autocapture}
                        onChange={(e) =>
                          setNewSiteData({
                            ...newSiteData,
                            autocapture: e.target.checked,
                          })
                        }
                        className="rounded border-[var(--theme-border-primary)]"
                      />
                      <span className="text-sm text-[var(--theme-text-primary)]">
                        Autocapture
                      </span>
                    </label>
                    <p className="text-xs text-[var(--theme-text-secondary)] mt-1 ml-6">
                      Automatically track clicks on links, buttons, and form submissions
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    onClick={handleAddSite}
                    disabled={isAddingSite}
                  >
                    {isAddingSite ? "Adding..." : "Add Site"}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {siteMessage ? (
            <div className="mb-6">
              <AlertBanner
                tone={siteMessage.type}
                message={siteMessage.text}
                onDismiss={() => setSiteMessage(null)}
              />
            </div>
          ) : null}

          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">
              Site
            </label>
            <SiteSelector
              initialSites={initialSites}
              initialSiteId={initialSiteId}
              wrapperClassName="w-full sm:w-[260px]"
              selectClassName="w-full"
            />
          </div>

          <div className="space-y-6">
            {currentSiteTag ? (
              <SiteTagInstallCard site={currentSiteTag} />
            ) : (
              <div className="text-center py-8">
                <p className="text-[var(--theme-text-secondary)]">
                  {isSessionLoading
                    ? "Loading site information..."
                    : "No site selected"}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default SettingsPage;
