import { useContext } from "react";
import { AuthContext } from "@/app/providers/AuthProvider";

const LAST_SITE_KEY = "lytx_last_site_id";

/** Save to localStorage for immediate access on next page load */
function saveLastSiteToStorage(site_id: number): void {
  try {
    localStorage.setItem(LAST_SITE_KEY, String(site_id));
  } catch {
    // localStorage might not be available
  }
}

/** Get last site from localStorage */
export function getLastSiteFromStorage(): number | null {
  try {
    const stored = localStorage.getItem(LAST_SITE_KEY);
    return stored ? parseInt(stored, 10) : null;
  } catch {
    return null;
  }
}

/** Persist to database for cross-device sync */
async function updateLastSiteInDB(site_id: number): Promise<void> {
  try {
    const response = await fetch("/api/user/update-last-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id }),
    });
    if (!response.ok) {
      console.error("Failed to update last site:", await response.text());
    }
  } catch (error) {
    console.error("Error updating last site:", error);
  }
}

type SiteSelectorProps = {
  callBack?: (opts: { name: string; id: number; tag_id: string }) => void;
  initialSites?: Array<{ site_id: number; name: string; tag_id: string }>;
  initialSiteId?: number | null;
  wrapperClassName?: string;
  selectClassName?: string;
};
export const SiteSelector: React.FC<SiteSelectorProps> = ({
  initialSites = [],
  initialSiteId = null,
  wrapperClassName,
  selectClassName,
}) => {
  const {
    data: session,
    current_site,
    setCurrentSite,
  } = useContext(AuthContext);

  const sites = session?.userSites && session.userSites.length > 0
    ? session.userSites.map((site) => ({
      site_id: site.site_id,
      name: site.name || `Site ${site.site_id}`,
      tag_id: site.tag_id,
    }))
    : initialSites;

  const selectedSiteName = current_site?.name
    ?? sites.find((site) => site.site_id === initialSiteId)?.name
    ?? sites[0]?.name
    ?? "";

  const combinedWrapperClassName = ["relative inline-block", wrapperClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={combinedWrapperClassName}>
      <select
        value={selectedSiteName}
        onChange={(e) => {
          const selectedSite = sites.find(
            (site) => site.name === e.target.value,
          );
          if (selectedSite) {
            setCurrentSite({
              name: selectedSite.name,
              id: selectedSite.site_id,
              tag_id: selectedSite.tag_id,
            });
            // Save to localStorage for immediate access on page reload
            saveLastSiteToStorage(selectedSite.site_id);
            // Persist to database for cross-device sync (fire and forget)
            updateLastSiteInDB(selectedSite.site_id);
          }
        }}
        className={`appearance-none bg-[var(--theme-input-bg)] pl-4 pr-10 py-2 text-sm text-left text-[var(--theme-text-primary)] rounded-lg border border-[var(--theme-input-border)] focus:border-[var(--theme-border-primary)] focus:outline-none transition-colors ${selectClassName ?? ""}`}
      >
        {sites.length > 0
          ? sites.map((site) => (
              <option key={site.site_id} value={site.name} className="text-left">
                {site.name}
              </option>
            ))
          : ""}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[var(--theme-text-secondary)]">
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
};
