"use client";

import { useContext, useState } from "react";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { SiteSelector } from "@components/SiteSelector";
import { AuthContext } from "@/app/providers/AuthProvider";
import { SQLEditor } from "@components/SQLEditor";

type ExploreInitialSite = {
  site_id: number;
  name: string;
  tag_id: string;
};

type ExplorePageProps = {
  initialSites?: ExploreInitialSite[];
  initialSiteId?: number | null;
};

/** Convert rows to CSV format */
function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  
  const headers = Object.keys(rows[0]);
  const csvRows: string[] = [];
  
  // Header row
  csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","));
  
  // Data rows
  for (const row of rows) {
    const values = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
      return String(val);
    });
    csvRows.push(values.join(","));
  }
  
  return csvRows.join("\n");
}

/** Convert rows to SQL INSERT statements */
function rowsToSql(rows: Record<string, unknown>[], tableName = "site_events"): string {
  if (rows.length === 0) return "";
  
  const headers = Object.keys(rows[0]);
  const statements: string[] = [];
  
  for (const row of rows) {
    const values = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return "NULL";
      if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
      if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
      if (typeof val === "number") return String(val);
      return `'${String(val).replace(/'/g, "''")}'`;
    });
    statements.push(`INSERT INTO ${tableName} (${headers.join(", ")}) VALUES (${values.join(", ")});`);
  }
  
  return statements.join("\n");
}

/** Download data as a file */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExplorePage({ initialSites = [], initialSiteId = null }: ExplorePageProps) {
  const {
    current_site,
  } = useContext(AuthContext) || {
    current_site: null,
  };

  const currentSiteId = current_site?.id ?? initialSiteId;

  const [sqlQuery, setSqlQuery] = useState("");
  const [sqlStatus, setSqlStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlResult, setSqlResult] = useState<null | {
    rowCount: number;
    rows: Record<string, unknown>[];
  }>(null);

  async function runSqlQuery() {
    try {
      setSqlError(null);
      setSqlStatus("loading");
      setSqlResult(null);

      if (!currentSiteId) {
        setSqlStatus("error");
        setSqlError("Select a site first.");
        return;
      }

      if (!sqlQuery.trim()) {
        setSqlStatus("error");
        setSqlError("Enter a SQL query to run.");
        return;
      }

      const response = await fetch("/api/site-events/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: currentSiteId,
          query: sqlQuery,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; rows?: Record<string, unknown>[]; rowCount?: number }
        | null;

      if (!response.ok) {
        setSqlStatus("error");
        setSqlError(data?.error || response.statusText || "Query failed");
        return;
      }

      setSqlResult({
        rows: data?.rows ?? [],
        rowCount: data?.rowCount ?? 0,
      });
      setSqlStatus("success");
    } catch (error) {
      console.error("SQL query failed", error);
      setSqlStatus("error");
      setSqlError("Query failed");
    }
  }

  return (
    <div className="p-6 bg-[var(--theme-bg-primary)] min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--theme-text-primary)] mb-2">
            Explore
          </h1>
          <p className="text-[var(--theme-text-secondary)]">
            Query your site's event data directly using SQL. Use the Schema tab to see available columns and try example queries.
          </p>
        </div>

        {/* Site Selector */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-[var(--theme-text-primary)]">
              Site:
            </span>
            <SiteSelector initialSites={initialSites} initialSiteId={initialSiteId} />
          </div>
        </Card>

        {/* SQL Explorer */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[var(--theme-text-primary)]">
              SQL Explorer
            </h2>
            <Button
              variant="secondary"
              onClick={() => {
                setSqlResult(null);
                setSqlError(null);
                setSqlStatus("idle");
                setSqlQuery("");
              }}
              disabled={sqlStatus === "loading"}
            >
              Clear
            </Button>
          </div>

          <p className="text-sm text-[var(--theme-text-secondary)] mb-4">
            Run read-only SQL queries against your site's event data. Check the Schema tab for available columns and indexes.
          </p>

          <label className="block text-xs font-medium text-[var(--theme-text-secondary)] mb-2">
            Query (SELECT only)
          </label>
          <SQLEditor
            value={sqlQuery}
            onChange={setSqlQuery}
            onSubmit={() => void runSqlQuery()}
            placeholder="SELECT event, page_url, created_at FROM site_events ORDER BY created_at DESC LIMIT 50"
            disabled={sqlStatus === "loading"}
            height="400px"
            siteId={currentSiteId ?? undefined}
          />

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-[var(--theme-text-secondary)]">
              Results are limited to 500 rows.
            </p>
            <Button
              variant="primary"
              onClick={() => void runSqlQuery()}
              disabled={sqlStatus === "loading" || !currentSiteId}
            >
              {sqlStatus === "loading" ? "Running…" : "Run Query"}
            </Button>
          </div>

          {sqlError && (
            <div className="mt-4 p-3 rounded border border-red-500 text-red-400 bg-red-500/10">
              {sqlError}
            </div>
          )}

          {sqlResult && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-[var(--theme-text-secondary)]">
                  Rows returned: <span className="font-medium text-[var(--theme-text-primary)]">{sqlResult.rowCount}</span>
                </div>
                {sqlResult.rows.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--theme-text-secondary)]">Export:</span>
                    <button
                      onClick={() => {
                        const csv = rowsToCsv(sqlResult.rows);
                        downloadFile(csv, `query-results-${Date.now()}.csv`, "text/csv");
                      }}
                      className="px-2 py-1 text-xs font-medium rounded bg-[var(--theme-bg-secondary)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-input-border)] transition-colors"
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => {
                        const json = JSON.stringify(sqlResult.rows, null, 2);
                        downloadFile(json, `query-results-${Date.now()}.json`, "application/json");
                      }}
                      className="px-2 py-1 text-xs font-medium rounded bg-[var(--theme-bg-secondary)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-input-border)] transition-colors"
                    >
                      JSON
                    </button>
                    <button
                      onClick={() => {
                        const sql = rowsToSql(sqlResult.rows);
                        downloadFile(sql, `query-results-${Date.now()}.sql`, "text/plain");
                      }}
                      className="px-2 py-1 text-xs font-medium rounded bg-[var(--theme-bg-secondary)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-input-border)] transition-colors"
                    >
                      SQL
                    </button>
                  </div>
                )}
              </div>
              {sqlResult.rows.length > 0 ? (
                <div className="overflow-x-auto border border-[var(--theme-border-primary)] rounded-lg">
                  <table className="min-w-full divide-y divide-[var(--theme-border-primary)]">
                    <thead className="bg-[var(--theme-card-bg)]">
                      <tr>
                        {Object.keys(sqlResult.rows[0]).map((key) => (
                          <th
                            key={key}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--theme-text-secondary)]"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--theme-border-primary)]">
                      {sqlResult.rows.slice(0, 100).map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-[var(--theme-bg-secondary)]">
                          {Object.keys(sqlResult.rows[0]).map((key) => (
                            <td key={key} className="px-4 py-3 text-sm whitespace-pre-wrap text-[var(--theme-text-primary)]">
                              {row[key] === null || row[key] === undefined
                                ? <span className="text-[var(--theme-text-secondary)]">—</span>
                                : typeof row[key] === "object"
                                  ? JSON.stringify(row[key])
                                  : String(row[key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-[var(--theme-text-secondary)]">No rows returned.</p>
              )}
              {sqlResult.rows.length > 100 && (
                <p className="text-xs text-[var(--theme-text-secondary)]">
                  Showing first 100 rows of {sqlResult.rowCount}.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default ExplorePage;
