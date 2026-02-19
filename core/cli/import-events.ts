#!/usr/bin/env bun
import { createId } from "@paralleldrive/cuid2";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { siteEvents as pgSiteEvents } from "@db/postgres/schema";
import { eq } from "drizzle-orm";

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
Usage: bun run cli/import-events.ts [options]

Options:
  -t, --team-id <id>        Team ID for the events (required)
  -s, --site-id <id>        Site ID for the events (required)
  -d, --database <name>     Database name (default: "lytx_core_db")
  --local                   Use local database (default: true)
  --remote                  Use remote database (default: false)
  --from-db <url>           Import from PostgreSQL database (provide connection string)
  --from-site-id <id>       Source site ID to import from (when using --from-db)
  -h, --help               Show this help message

Event Data Sources:
  1. JSON via stdin (default):
     The script expects JSON data piped to stdin with the following structure:
  [
    {
      "event": "page_view",
      "client_page_url": "/home",
      "page_url": "https://example.com/home",
      "referer": "https://google.com",
      "browser": "Chrome 120.0.0",
      "operating_system": "Windows 11",
      "device_type": "desktop",
      "country": "US",
      "region": "California",
      "city": "San Francisco",
      "postal": "94102",
      "screen_width": 1920,
      "screen_height": 1080,
      "rid": "visitor_id_123",
      "custom_data": {"key": "value"},
      "bot_data": {"is_bot": false},
      "query_params": {"utm_source": "google"},
      "created_at": 1640995200
    },
    ...
  ]

Required fields:
  - event: Event type (string)

Optional fields:
  - client_page_url: Client page URL (string)
  - page_url: Full page URL (string)
  - referer: Referrer URL (string)
  - browser: Browser info (string)
  - operating_system: OS info (string)
  - device_type: Device type (string)
  - country: Country code (string)
  - region: Region/state (string)
  - city: City name (string)
  - postal: Postal code (string)
  - screen_width: Screen width (number)
  - screen_height: Screen height (number)
  - rid: Visitor ID (string, auto-generated if not provided)
  - custom_data: Custom data object (object)
  - bot_data: Bot detection data (object)
  - query_params: Query parameters (object)
  - created_at: Unix timestamp in seconds (number, defaults to current time)

  2. PostgreSQL database:
     Use --from-db with a connection string to import from another database

Examples:
  # Import from JSON stdin
  echo '[{"event":"page_view","client_page_url":"/"}]' | bun run cli/import-events.ts --team-id 1 --site-id 5
  cat events.json | bun run cli/import-events.ts --team-id 1 --site-id 5 --remote
  bun run cli/import-events.ts --team-id 1 --site-id 5 --local < events.json
  
  # Import from PostgreSQL database
  bun run cli/import-events.ts --team-id 1 --site-id 5 --from-db "postgresql://user:pass@host:5432/db" --from-site-id 10
  bun run cli/import-events.ts --team-id 1 --site-id 5 --from-db "$DATABASE_URL" --from-site-id 10 --remote
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

const getSiteIdArg = () => {
  try {
    return parseInt(getArg("--site-id"));
  } catch {
    return parseInt(getArg("-s"));
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

const getFromSiteIdArg = () => {
  try {
    return parseInt(getArg("--from-site-id"));
  } catch {
    return null;
  }
};

const teamId = getTeamIdArg();
const siteId = getSiteIdArg();
const database = getDatabaseArg();
const fromDb = getFromDbArg();
const fromSiteId = getFromSiteIdArg();
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

// Helper function to validate site exists and get tag_id
async function validateSiteAndGetTagId(
  teamId: number,
  siteId: number,
): Promise<string> {
  const validateSiteSQL = `SELECT site_id, tag_id, name, domain FROM sites WHERE site_id = ${siteId} AND team_id = ${teamId};`;
  const tempFile = join(process.cwd(), `temp_query_${Date.now()}.sql`);
  writeFileSync(tempFile, validateSiteSQL);

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
      throw new Error(`Invalid JSON format from wrangler.`, { cause: parseError });
    }

    if (!jsonResult || !jsonResult[0] || !jsonResult[0].results) {
      throw new Error(
        `Unexpected response format from wrangler: ${JSON.stringify(jsonResult)}`,
      );
    }

    if (!jsonResult || !jsonResult[0] || !jsonResult[0].results) {
      throw new Error(
        `Unexpected response format from wrangler: ${JSON.stringify(jsonResult)}`,
      );
    }

    if (jsonResult[0].results.length === 0) {
      throw new Error(
        `Site ID ${siteId} not found or doesn't belong to team ${teamId}`,
      );
    }

    const site = jsonResult[0].results[0];
    console.log(
      `✅ Found site: ${site.name} (${site.domain}) - Tag ID: ${site.tag_id}`,
    );
    return site.tag_id;
  } catch (error: any) {
    console.error("❌ Error validating site:", error.message);
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
  sourceSiteId: number,
): Promise<EventInput[]> {
  console.log("📖 Reading events from PostgreSQL database...");

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    const events = await db
      .select({
        event: pgSiteEvents.event,
        client_page_url: pgSiteEvents.client_page_url,
        page_url: pgSiteEvents.page_url,
        referer: pgSiteEvents.referer,
        browser: pgSiteEvents.browser,
        operating_system: pgSiteEvents.operating_system,
        device_type: pgSiteEvents.device_type,
        country: pgSiteEvents.country,
        region: pgSiteEvents.region,
        city: pgSiteEvents.city,
        postal: pgSiteEvents.postal,
        screen_width: pgSiteEvents.screen_width,
        screen_height: pgSiteEvents.screen_height,
        rid: pgSiteEvents.rid,
        custom_data: pgSiteEvents.custom_data,
        bot_data: pgSiteEvents.bot_data,
        query_params: pgSiteEvents.query_params,
        created_at: pgSiteEvents.created_at,
      })
      .from(pgSiteEvents)
      .where(eq(pgSiteEvents.site_id, sourceSiteId));

    console.log(`✅ Found ${events.length} events in source database`);

    return events.map((event) => ({
      event: event.event || "page_view",
      client_page_url: event.client_page_url || undefined,
      page_url: event.page_url || undefined,
      referer: event.referer || undefined,
      browser: event.browser || undefined,
      operating_system: event.operating_system || undefined,
      device_type: event.device_type || undefined,
      country: event.country || undefined,
      region: event.region || undefined,
      city: event.city || undefined,
      postal: event.postal || undefined,
      screen_width: event.screen_width || undefined,
      screen_height: event.screen_height || undefined,
      rid: event.rid || undefined,
      custom_data: event.custom_data || undefined,
      bot_data: event.bot_data || undefined,
      query_params: event.query_params || undefined,
      created_at: event.created_at
        ? Math.floor(new Date(event.created_at).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
    }));
  } catch (error: any) {
    throw new Error(`Failed to read from database: ${error.message}`, { cause: error });
  } finally {
    await sql.end();
  }
}

// Helper function to read stdin
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";

    process.stdin.setEncoding("utf8");

    process.stdin.on("readable", () => {
      let chunk;
      while (null !== (chunk = process.stdin.read())) {
        data += chunk;
      }
    });

    process.stdin.on("end", () => {
      resolve(data.trim());
    });

    process.stdin.on("error", reject);
  });
}

// Event interface based on schema
interface EventInput {
  event: string;
  client_page_url?: string;
  page_url?: string;
  referer?: string;
  browser?: string;
  operating_system?: string;
  device_type?: string;
  country?: string;
  region?: string;
  city?: string;
  postal?: string;
  screen_width?: number;
  screen_height?: number;
  rid?: string;
  custom_data?: object;
  bot_data?: object;
  query_params?: object;
  created_at?: number;
}

// Validate event data
function validateEventData(events: any[]): EventInput[] {
  if (!Array.isArray(events)) {
    throw new Error("Input must be an array of event objects");
  }

  return events.map((event, index) => {
    if (typeof event !== "object" || event === null) {
      throw new Error(`Event at index ${index} must be an object`);
    }

    if (!event.event || typeof event.event !== "string") {
      throw new Error(
        `Event at index ${index} must have a valid 'event' field (string)`,
      );
    }

    // Validate optional string fields
    const stringFields = [
      "client_page_url",
      "page_url",
      "referer",
      "browser",
      "operating_system",
      "device_type",
      "country",
      "region",
      "city",
      "postal",
      "rid",
    ];
    for (const field of stringFields) {
      if (event[field] !== undefined && typeof event[field] !== "string") {
        throw new Error(`Event at index ${index}: '${field}' must be a string`);
      }
    }

    // Validate optional number fields
    const numberFields = ["screen_width", "screen_height", "created_at"];
    for (const field of numberFields) {
      if (event[field] !== undefined && typeof event[field] !== "number") {
        throw new Error(`Event at index ${index}: '${field}' must be a number`);
      }
    }

    // Validate optional object fields
    const objectFields = ["custom_data", "bot_data", "query_params"];
    for (const field of objectFields) {
      if (
        event[field] !== undefined &&
        (typeof event[field] !== "object" || event[field] === null)
      ) {
        throw new Error(
          `Event at index ${index}: '${field}' must be an object`,
        );
      }
    }

    return {
      event: event.event.trim(),
      client_page_url: event.client_page_url?.trim(),
      page_url: event.page_url?.trim(),
      referer: event.referer?.trim(),
      browser: event.browser?.trim(),
      operating_system: event.operating_system?.trim(),
      device_type: event.device_type?.trim(),
      country: event.country?.trim(),
      region: event.region?.trim(),
      city: event.city?.trim(),
      postal: event.postal?.trim(),
      screen_width: event.screen_width,
      screen_height: event.screen_height,
      rid: event.rid?.trim() || createId(), // Generate if not provided
      custom_data: event.custom_data,
      bot_data: event.bot_data,
      query_params: event.query_params,
      created_at: event.created_at || Math.floor(Date.now() / 1000), // Default to current time
    };
  });
}

// Helper function to escape SQL strings and handle nulls
function sqlValue(value: any): string {
  if (value === undefined || value === null) {
    return "NULL";
  }
  if (typeof value === "string") {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return String(value);
}

async function importEvents() {
  try {
    console.log("🚀 Starting event import...");
    console.log(`📊 Target: ${database} (${isLocal ? "local" : "remote"})`);
    console.log(`🏢 Team ID: ${teamId}`);
    console.log(`🌐 Site ID: ${siteId}`);

    // Validate site exists and get tag_id
    const tagId = await validateSiteAndGetTagId(teamId, siteId);

    // Get event data from either database or stdin
    let events: EventInput[];

    if (fromDb) {
      if (!fromSiteId) {
        throw new Error("--from-site-id is required when using --from-db");
      }
      console.log(
        `📊 Source: PostgreSQL database (Source Site ID: ${fromSiteId})`,
      );
      events = await readFromDatabase(fromDb, fromSiteId);
    } else {
      // Read JSON data from stdin
      console.log("📖 Reading event data from stdin...");
      const stdinData = await readStdin();

      if (!stdinData) {
        throw new Error(
          "No data provided via stdin. Please pipe JSON data to this command.",
        );
      }

      // Parse JSON
      let eventsData: any;
      try {
        eventsData = JSON.parse(stdinData);
      } catch (error: any) {
        throw new Error(`Invalid JSON format: ${error.message}`, { cause: error });
      }

      // Validate event data
      events = validateEventData(eventsData);
    }
    console.log(`📋 Found ${events.length} events to import`);

    if (events.length === 0) {
      console.log("ℹ️  No events to import");
      return;
    }

    // Import events in batches
    const batchSize = 50;
    let totalImported = 0;

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(events.length / batchSize);

      console.log(
        `\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} events)`,
      );

      // Build batch SQL
      const eventValues = batch
        .map((event) => {
          const updatedAt = event.created_at; // Use same timestamp for updated_at

          return `(
          ${sqlValue(tagId)},
          ${siteId},
          ${teamId},
          ${sqlValue(event.bot_data)},
          ${sqlValue(event.browser)},
          ${sqlValue(event.city)},
          ${sqlValue(event.client_page_url)},
          ${sqlValue(event.country)},
          ${event.created_at},
          ${updatedAt},
          ${sqlValue(event.custom_data)},
          ${sqlValue(event.device_type)},
          ${sqlValue(event.event)},
          ${sqlValue(event.operating_system)},
          ${sqlValue(event.page_url)},
          ${sqlValue(event.postal)},
          ${sqlValue(event.query_params)},
          ${sqlValue(event.referer)},
          ${sqlValue(event.region)},
          ${sqlValue(event.rid)},
          ${event.screen_height || "NULL"},
          ${event.screen_width || "NULL"}
        )`;
        })
        .join(",\n");

      const batchSQL = `
INSERT INTO site_events (
  tag_id, site_id, team_id, bot_data, browser, city, client_page_url, country,
  created_at, updated_at, custom_data, device_type, event, operating_system,
  page_url, postal, query_params, referer, region, rid, screen_height, screen_width
)
VALUES ${eventValues};
`;

      executeSQL(batchSQL, `Importing batch ${batchNumber}/${totalBatches}`);
      totalImported += batch.length;
    }

    console.log("\n✅ Event import complete!");
    console.log(`
📊 Summary:
  Events imported: ${totalImported}
  Site ID: ${siteId}
  Tag ID: ${tagId}
  Team ID: ${teamId}
  Database: ${database} (${isLocal ? "local" : "remote"})
`);

    console.log(`
🚀 Next steps:
  1. Start the dev server: bun run dev
  2. Login and check the analytics dashboard
  3. Verify the events appear for the imported site
  4. Use the data for testing and analysis
`);
  } catch (error) {
    console.error("❌ Error importing events:", error);
    process.exit(1);
  }
}

// Validate required arguments
if (!teamId || isNaN(teamId)) {
  console.error("❌ Error: --team-id is required and must be a number");
  console.log("Use --help for usage information");
  process.exit(1);
}

if (!siteId || isNaN(siteId)) {
  console.error("❌ Error: --site-id is required and must be a number");
  console.log("Use --help for usage information");
  process.exit(1);
}

// Validate data source
if (fromDb) {
  if (!fromSiteId || isNaN(fromSiteId)) {
    console.error(
      "❌ Error: --from-site-id is required and must be a number when using --from-db",
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
importEvents();
