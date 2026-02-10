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
};
export const SiteSelector: React.FC<SiteSelectorProps> = (_props) => {
  const {
    data: session,
    current_site,
    isPending,
    setCurrentSite,
  } = useContext(AuthContext);

  return (
    <div>
      <select
        value={current_site?.name ?? ""}
        onChange={(e) => {
          if (!session) return;
          if (!session.userSites) return;
          const selectedSite = session.userSites.find(
            (site) => site.name === e.target.value,
          );
          if (selectedSite) {
            setCurrentSite({
              name: selectedSite.name!,
              id: selectedSite.site_id,
              tag_id: selectedSite.tag_id,
            });
            // Save to localStorage for immediate access on page reload
            saveLastSiteToStorage(selectedSite.site_id);
            // Persist to database for cross-device sync (fire and forget)
            updateLastSiteInDB(selectedSite.site_id);
          }
        }}
        className="bg-[var(--theme-input-bg)] text-sm text-[var(--theme-text-primary)] rounded-md border border-[var(--theme-input-border)] focus:border-[var(--theme-border-primary)] focus:outline-none text-center"
      >
        {!isPending && session && session.userSites
          ? session.userSites.map((site) => (
              <option key={site.site_id} value={site.name!}>
                {site.name}
              </option>
            ))
          : ""}
      </select>
    </div>
  );
};
