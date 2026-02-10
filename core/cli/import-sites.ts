#!/usr/bin/env bun
import { createId } from "@paralleldrive/cuid2";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sites as pgSites } from "@db/postgres/schema";
import { eq, and } from "drizzle-orm";

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (flag: string, defaultValue?: string): string => {
  const index = args.indexOf(flag);
  if (index === -1) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required argument: ${flag}`);
  }
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`Invalid value for ${flag}`);
  }
  return value;
};

const hasFlag = (flag: string): boolean => args.includes(flag);

// Check for help flag first
if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Usage: bun run cli/import-sites.ts [options]

Options:
  -t, --team-id <id>        Team ID to import sites for (required)
  -d, --database <name>     Database name (default: "lytx_core_db")
  --local                   Use local database (default: true)
  --remote                  Use remote database (default: false)
  --from-db <url>           Import from PostgreSQL database (provide connection string)
  --from-account-id <id>    Account ID to import from (when using --from-db)
  --remote-site-id <id>     Specific site ID to import from remote DB (optional filter)
  -h, --help               Show this help message

Site Data Sources:
  1. JSON via stdin (default):
     The script expects JSON data piped to stdin with the following structure:
  [
    {
      "name": "Site Name",
      "domain": "example.com",
      "track_web_events": true,
      "gdpr": false,
      "event_load_strategy": "sdk"
    },
    ...
  ]

Required fields:
  - name: Site name (string)
  - domain: Site domain (string)

Optional fields:
  - track_web_events: Enable web event tracking (boolean, default: true)
  - gdpr: GDPR compliance mode (boolean, default: false)
  - event_load_strategy: "sdk" to skip KV events (default: "sdk")

  2. PostgreSQL database:
     Use --from-db with a connection string to import from another database

Examples:
  # Import from JSON stdin
  echo '[{"name":"My Site","domain":"example.com"}]' | bun run cli/import-sites.ts --team-id 1
  cat sites.json | bun run cli/import-sites.ts --team-id 1 --remote
  bun run cli/import-sites.ts --team-id 1 --local < sites.json
  
  # Import from PostgreSQL database
  bun run cli/import-sites.ts --team-id 1 --from-db "postgresql://user:pass@host:5432/db" --from-account-id 5
  bun run cli/import-sites.ts --team-id 1 --from-db "$DATABASE_URL" --from-account-id 5 --remote
  
  # Import specific site from PostgreSQL database
  bun run cli/import-sites.ts --team-id 6 --from-db "$DATABASE_URL" --from-account-id 4 --remote-site-id 55 --remote
`);
  process.exit(0);
}

// CLI argument parsing
const getTeamIdArg = () => {
  try {
    return parseInt(getArg("--team-id"));
  } catch {
    return parseInt(getArg("-t"));
  }
};

const getDatabaseArg = () => {
  try {
    return getArg("--database");
  } catch {
    try {
      return getArg("-d");
    } catch {
      return "lytx_core_db";
    }
  }
};

const getFromDbArg = () => {
  try {
    return getArg("--from-db");
  } catch {
    return null;
  }
};

const getFromAccountIdArg = () => {
  try {
    return parseInt(getArg("--from-account-id"));
  } catch {
    return null;
  }
};

const getRemoteSiteIdArg = () => {
  try {
    return parseInt(getArg("--remote-site-id"));
  } catch {
    return null;
  }
};

type SiteInput = {
  name: string;
  domain: string;
  track_web_events?: boolean;
  gdpr?: boolean;
  event_load_strategy?: "sdk" | "kv";
};

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", (error: Error) => reject(error));
  });
}

function validateSiteData(input: unknown): SiteInput[] {
  if (!Array.isArray(input)) {
    throw new Error("Site data must be an array of sites");
  }

  return input.map((site, index) => {
    if (!site || typeof site !== "object") {
      throw new Error(`Site at index ${index} must be an object`);
    }

    const parsed = site as SiteInput;
    if (!parsed.name || typeof parsed.name !== "string") {
      throw new Error(`Site at index ${index} is missing a valid name`);
    }
    if (!parsed.domain || typeof parsed.domain !== "string") {
      throw new Error(`Site at index ${index} is missing a valid domain`);
    }

    if (parsed.track_web_events !== undefined && typeof parsed.track_web_events !== "boolean") {
      throw new Error(`Site at index ${index}: 'track_web_events' must be a boolean`);
    }
    if (parsed.gdpr !== undefined && typeof parsed.gdpr !== "boolean") {
      throw new Error(`Site at index ${index}: 'gdpr' must be a boolean`);
    }
    if (
      parsed.event_load_strategy !== undefined &&
      parsed.event_load_strategy !== "sdk" &&
      parsed.event_load_strategy !== "kv"
    ) {
      throw new Error(`Site at index ${index}: 'event_load_strategy' must be "sdk" or "kv"`);
    }

    return {
      name: parsed.name,
      domain: parsed.domain,
      track_web_events: parsed.track_web_events ?? true,
      gdpr: parsed.gdpr ?? false,
      event_load_strategy: parsed.event_load_strategy ?? "sdk",
    };
  });
}

const teamId = getTeamIdArg();
const database = getDatabaseArg();
const fromDb = getFromDbArg();
const fromAccountId = getFromAccountIdArg();
const remoteSiteId = getRemoteSiteIdArg();
const isRemote = hasFlag("--remote");
const isLocal = hasFlag("--local") || !isRemote;

// Helper function to execute SQL via wrangler
function executeSQL(sql: string, description: string) {
  console.log(`📝 ${description}...`);

  const tempFile = join(process.cwd(), `temp_${Date.now()}.sql`);
  writeFileSync(tempFile, sql);

  try {
    const command = `bunx wrangler d1 execute ${database} --file ${tempFile} ${isLocal ? "--local" : "--remote"} --yes`;
    const result = execSync(command, { encoding: "utf8", stdio: "pipe" });
    console.log(`✅ ${description} completed`);
    return result;
  } catch (error: any) {
    console.error(`❌ Error during ${description}:`, error.message);
    throw error;
  } finally {
    try {
      unlinkSync(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Helper function to validate team exists
async function validateTeam(teamId: number): Promise<void> {
  const validateTeamSQL = `SELECT id, name FROM team WHERE id = ${teamId};`;
  const tempFile = join(process.cwd(), `temp_query_${Date.now()}.sql`);
  writeFileSync(tempFile, validateTeamSQL);

  try {
    const command = `bunx wrangler d1 execute ${database} --file ${tempFile} ${isLocal ? "--local" : "--remote"} --json --yes`;
    const result = execSync(command, { encoding: "utf8", stdio: "pipe" });

    // Extract JSON from wrangler output (skip progress indicators)
    const jsonStart = result.indexOf("[");
    const jsonEnd = result.lastIndexOf("]") + 1;

    if (jsonStart === -1 || jsonEnd === 0) {
      console.error("❌ No JSON found in wrangler output:");
      console.error("Raw output:", result);
      throw new Error(
        `Wrangler did not return valid JSON. Check database connection and permissions.`,
      );
    }

    const jsonString = result.substring(jsonStart, jsonEnd);

    let jsonResult;
    try {
      jsonResult = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("❌ Failed to parse extracted JSON:");
      console.error("Extracted JSON:", jsonString);
      throw new Error(`Invalid JSON format from wrangler.`);
    }

    if (!jsonResult || !jsonResult[0] || !jsonResult[0].results) {
      throw new Error(
        `Unexpected response format from wrangler: ${JSON.stringify(jsonResult)}`,
      );
    }

    if (jsonResult[0].results.length === 0) {
      throw new Error(`Team ID ${teamId} not found`);
    }

    const team = jsonResult[0].results[0];
    console.log(
      `✅ Found team: ${team.name || "Unknown"} (ID: ${team.id || teamId})`,
    );
  } catch (error: any) {
    console.error("❌ Error validating team:", error.message);
    throw error;
  } finally {
    try {
      unlinkSync(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Helper function to read from PostgreSQL database
async function readFromDatabase(
  connectionString: string,
  accountId: number,
  siteId?: number,
): Promise<SiteInput[]> {
  console.log("📖 Reading sites from PostgreSQL database...");
  if (siteId) {
    console.log(`🎯 Filtering for specific site ID: ${siteId}`);
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Build where conditions
    const whereConditions = [eq(pgSites.account_id, accountId)];
    if (siteId) {
      whereConditions.push(eq(pgSites.site_id, siteId));
    }

    const sites = await db
      .select({
        site_id: pgSites.site_id,
        tag_id: pgSites.tag_id,
        domain: pgSites.domain,
        track_web_events: pgSites.track_web_events,
        gdpr: pgSites.gdpr,
        event_load_strategy: pgSites.event_load_strategy ?? "sdk",
      })
      .from(pgSites)
      .where(and(...whereConditions));

    return sites.map((site) => ({
      name: site.domain || `Site ${site.site_id}`,
      domain: site.domain ?? "",
      track_web_events: site.track_web_events ?? true,
      gdpr: site.gdpr ?? false,
      event_load_strategy: (site.event_load_strategy ?? "sdk") as "sdk" | "kv",
    }));
  } finally {
    await sql.end();
  }
}

async function importSites() {
  try {
    console.log("🚀 Starting site import...");
    console.log(`📊 Target: ${database} (${isLocal ? "local" : "remote"})`);
    console.log(`🏢 Team ID: ${teamId}`);

    // Validate team exists
    await validateTeam(teamId);

    // Get site data from either database or stdin
    let sites: SiteInput[];

    if (fromDb) {
      if (!fromAccountId) {
        throw new Error("--from-account-id is required when using --from-db");
      }
      console.log(
        `📊 Source: PostgreSQL database (Account ID: ${fromAccountId}${remoteSiteId ? `, Site ID: ${remoteSiteId}` : ""})`,
      );
      sites = await readFromDatabase(
        fromDb,
        fromAccountId,
        remoteSiteId || undefined,
      );
    } else {
      // Read JSON data from stdin
      console.log("📖 Reading site data from stdin...");
      const stdinData = await readStdin();

      if (!stdinData) {
        throw new Error(
          "No data provided via stdin. Please pipe JSON data to this command.",
        );
      }

      // Parse JSON
      let sitesData: any;
      try {
        sitesData = JSON.parse(stdinData);
      } catch (error: any) {
        throw new Error(`Invalid JSON format: ${error.message}`);
      }

      // Validate site data
      sites = validateSiteData(sitesData);
    }
    console.log(`📋 Found ${sites.length} sites to import`);

    if (sites.length === 0) {
      console.log("ℹ️  No sites to import");
      return;
    }

    // Import sites
    const importedSites: Array<{
      name: string;
      domain: string;
      tagId: string;
      siteId?: number;
    }> = [];

    for (const [index, site] of sites.entries()) {
      console.log(
        `\n📦 Importing site ${index + 1}/${sites.length}: ${site.name}`,
      );

      // Generate unique IDs
      const tagId = createId();
      const ridSalt = createId();
      const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
      const ridSaltExpire = now + 30 * 24 * 60 * 60; // 30 days from now

      // Escape single quotes in strings for SQL
      const escapedName = site.name.replace(/'/g, "''");
      const escapedDomain = site.domain.replace(/'/g, "''");

      // Create site SQL
      const siteSQL = `
INSERT INTO sites (tag_id, track_web_events, event_load_strategy, team_id, name, domain, gdpr, rid_salt, rid_salt_expire, created_at, updated_at)
VALUES ('${tagId}', ${site.track_web_events ? 1 : 0}, '${site.event_load_strategy ?? "sdk"}', ${teamId}, '${escapedName}', '${escapedDomain}', ${site.gdpr ? 1 : 0}, '${ridSalt}', ${ridSaltExpire}, ${now}, ${now});
`;

      executeSQL(siteSQL, `Creating site: ${site.name}`);

      // Get the created site ID
      const getSiteIdSQL = `SELECT site_id FROM sites WHERE tag_id = '${tagId}';`;
      const tempFile = join(process.cwd(), `temp_query_${Date.now()}.sql`);
      writeFileSync(tempFile, getSiteIdSQL);

      try {
        const command = `bunx wrangler d1 execute ${database} --file ${tempFile} ${isLocal ? "--local" : "--remote"} --json --yes`;
        const result = execSync(command, { encoding: "utf8", stdio: "pipe" });

        // Extract JSON from wrangler output
        const jsonStart = result.indexOf("[");
        const jsonEnd = result.lastIndexOf("]") + 1;
        const jsonString = result.substring(jsonStart, jsonEnd);
        const jsonResult = JSON.parse(jsonString);
        const siteId =
          jsonResult[0].results[0].site_id || jsonResult[0].results[0].id;

        importedSites.push({
          name: site.name,
          domain: site.domain,
          tagId,
          siteId,
        });

        console.log(`✅ Created site ID: ${siteId} for ${site.name}`);
      } catch (error: any) {
        console.error(
          `❌ Error getting site ID for ${site.name}:`,
          error.message,
        );
        // Add to imported sites without siteId for reporting
        importedSites.push({
          name: site.name,
          domain: site.domain,
          tagId,
        });
      } finally {
        try {
          unlinkSync(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }

    console.log("\n✅ Site import complete!");
    console.log(`
📊 Summary:
  Sites imported: ${importedSites.length}
  Team ID: ${teamId}
  Database: ${database} (${isLocal ? "local" : "remote"})
`);

    console.log(`
🌐 Imported sites:
${importedSites
  .map(
    (site) =>
      `  - ${site.name} (${site.domain})${site.siteId ? ` - Site ID: ${site.siteId}` : ""} - Tag ID: ${site.tagId}`,
  )
  .join("\n")}
`);

    console.log(`
🚀 Next steps:
  1. Start the dev server: bun run dev
  2. Login and verify the sites appear in your dashboard
  3. Use the Tag IDs above to implement tracking on your sites
  4. Optionally run seed-data.ts to generate sample events for testing
`);
  } catch (error) {
    console.error("❌ Error importing sites:", error);
    process.exit(1);
  }
}

// Validate required arguments
if (!teamId || isNaN(teamId)) {
  console.error("❌ Error: --team-id is required and must be a number");
  console.log("Use --help for usage information");
  process.exit(1);
}

// Validate data source
if (fromDb) {
  if (!fromAccountId || isNaN(fromAccountId)) {
    console.error(
      "❌ Error: --from-account-id is required and must be a number when using --from-db",
    );
    console.log("Use --help for usage information");
    process.exit(1);
  }
} else {
  // Check if stdin has data (when not run interactively)
  if (process.stdin.isTTY) {
    console.error(
      "❌ Error: No data provided via stdin and --from-db not specified",
    );
    console.log(
      "Please pipe JSON data to this command or use --from-db option. Use --help for examples.",
    );
    process.exit(1);
  }
}

// Run the import
importSites();
