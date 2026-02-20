"use client";
import React, { useContext, useState } from "react";
import { AuthContext } from "@/app/providers/AuthProvider";
// import { SiteTag } from "@/app/components/SiteTag";
interface NewSiteSetupProps {
  onSiteCreated?: (siteData: any) => void;
}

export const NewSiteSetup: React.FC<NewSiteSetupProps> = ({
  onSiteCreated,
}) => {
  const { data: session } = useContext(AuthContext);
  const teamName = session?.team?.name || "";
  const [formData, setFormData] = useState({
    name: "",
    domain: "",
    track_web_events: true,
    gdpr: false,
    event_load_strategy: "sdk" as "sdk" | "kv",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to create site");
      }

      const siteData = await response.json();
      onSiteCreated?.(siteData);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--theme-bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between w-full p-6 border-b border-[var(--theme-border-primary)]">
        <div className="flex items-center space-x-3">
          <span className="text-[var(--theme-text-primary)] font-semibold">
            Welcome to Lytx Analytics
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mx-auto">
          {/* Welcome Section */}
          <section className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-[var(--theme-text-primary)] mb-4">
              Set up your first site{teamName ? ` for ${teamName}` : ""}
            </h1>
            <p className="text-[var(--theme-text-secondary)] text-lg">
              Get started by adding your website to begin tracking analytics and
              events.
            </p>
          </section>

          {/* Setup Form Card */}
          <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-lg p-8">
            <h2 className="text-xl font-semibold text-[var(--theme-text-primary)] mb-6">
              Site Configuration
            </h2>

            {error && (
              <div className="bg-[var(--color-danger)] bg-opacity-20 border border-[var(--color-danger)] text-[var(--color-danger)] px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Site Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2"
                >
                  Site Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-md text-[var(--theme-text-primary)] placeholder-[var(--theme-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-colors"
                  placeholder="My Awesome Website"
                />
                <p className="text-xs text-[var(--theme-text-secondary)] mt-1">
                  A friendly name to identify your site in the dashboard
                </p>
              </div>

              {/* Domain */}
              <div>
                <label
                  htmlFor="domain"
                  className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2"
                >
                  Domain
                </label>
                <input
                  type="url"
                  id="domain"
                  name="domain"
                  value={formData.domain}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-md text-[var(--theme-text-primary)] placeholder-[var(--theme-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-colors"
                  placeholder="https://example.com"
                />
                <p className="text-xs text-[var(--theme-text-secondary)] mt-1">
                  The full URL of your website (including https://)
                </p>
              </div>

              {/* Tracking Options */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-[var(--theme-text-primary)]">
                  Tracking Options
                </h3>

                <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="track_web_events"
                  name="track_web_events"
                  checked={formData.track_web_events}
                  onChange={handleInputChange}
                  className="mt-1 h-4 w-4 text-[var(--color-primary)] bg-[var(--theme-input-bg)] border-[var(--theme-input-border)] rounded focus:ring-[var(--color-primary)] focus:ring-2"
                />
                <div>
                  <label
                    htmlFor="track_web_events"
                    className="text-sm font-medium text-[var(--theme-text-primary)]"
                  >
                    Enable Web Event Tracking
                  </label>
                  <p className="text-xs text-[var(--theme-text-secondary)]">
                    Track page views, clicks, and custom events on your
                    website
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="event_load_strategy"
                  name="event_load_strategy"
                  checked={formData.event_load_strategy === "kv"}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      event_load_strategy: e.target.checked ? "kv" : "sdk",
                    }))
                  }
                  className="mt-1 h-4 w-4 text-[var(--color-primary)] bg-[var(--theme-input-bg)] border-[var(--theme-input-border)] rounded focus:ring-[var(--color-primary)] focus:ring-2"
                />
                <div>
                  <label
                    htmlFor="event_load_strategy"
                    className="text-sm font-medium text-[var(--theme-text-primary)]"
                  >
                    Load Events From KV
                  </label>
                  <p className="text-xs text-[var(--theme-text-secondary)]">
                    Include stored event rules in the site tag payload
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="gdpr"
                  name="gdpr"
                  checked={formData.gdpr}
                  onChange={handleInputChange}
                  className="mt-1 h-4 w-4 text-[var(--color-primary)] bg-[var(--theme-input-bg)] border-[var(--theme-input-border)] rounded focus:ring-[var(--color-primary)] focus:ring-2"
                />
                <div>
                  <label
                    htmlFor="gdpr"
                    className="text-sm font-medium text-[var(--theme-text-primary)]"
                  >
                    GDPR Compliance Mode
                  </label>
                  <p className="text-xs text-[var(--theme-text-secondary)]">
                    Enable additional privacy controls for EU visitors
                  </p>
                </div>
              </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[var(--theme-button-bg)] hover:bg-[var(--theme-button-hover)] disabled:bg-[var(--theme-text-secondary)] disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-md transition-colors duration-200"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Creating Site...
                    </div>
                  ) : (
                    "Create Site & Get Tracking Code"
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Next Steps Preview */}
          <div className="mt-8 bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-lg p-6">
            <h3 className="text-lg font-semibold text-[var(--theme-text-primary)] mb-4">
              What happens next?
            </h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-[var(--color-primary)] rounded-full flex items-center justify-center text-white text-sm font-bold">
                  1
                </div>
                <span className="text-[var(--theme-text-secondary)]">
                  We'll generate a unique tracking code for your site
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-[var(--color-primary)] rounded-full flex items-center justify-center text-white text-sm font-bold">
                  2
                </div>
                <span className="text-[var(--theme-text-secondary)]">
                  Add the tracking code to your website
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-[var(--color-primary)] rounded-full flex items-center justify-center text-white text-sm font-bold">
                  3
                </div>
                <span className="text-[var(--theme-text-secondary)]">
                  Open the dashboard to confirm ingestion and continue setup
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
