#!/usr/bin/env bun
import { createId } from "@paralleldrive/cuid2";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";

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
Usage: bun run db:seed [options]

Options:
  -t, --team-id <id>        Team ID to create sites for (required)
  -s, --sites <number>      Number of sites to create (default: 3)
  --site-id <id>            Populate existing site ID with events (skips site creation)
  -e, --events <number>     Number of events per site (default: 100)
  -d, --database <name>     Database name (default: "lytx_core_db")
  --local                   Use local database (default: true)
  --remote                  Use remote database (default: false)
  --days <number>           Number of days back to generate events (default: 30)
  -h, --help               Show this help message

Example:
  bun run db:seed --team-id 1 --sites 2 --events 50
  bun run db:seed --team-id 1 --remote --days 7
  bun run db:seed --team-id 1 --site-id 3 --events 100
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

const getSitesArg = () => {
  try {
    return parseInt(getArg("--sites"));
  } catch {
    try {
      return parseInt(getArg("-s"));
    } catch {
      return 3;
    }
  }
};

const getEventsArg = () => {
  try {
    return parseInt(getArg("--events"));
  } catch {
    try {
      return parseInt(getArg("-e"));
    } catch {
      return 100;
    }
  }
};

const getDaysArg = () => {
  try {
    return parseInt(getArg("--days"));
  } catch {
    return 30;
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

const getSiteIdArg = () => {
  try {
    return parseInt(getArg("--site-id"));
  } catch {
    return null; // Optional parameter
  }
};

const teamId = getTeamIdArg();
const numSites = getSitesArg();
const numEvents = getEventsArg();
const numDays = getDaysArg();
const database = getDatabaseArg();
const siteId = getSiteIdArg();
const isRemote = hasFlag("--remote");
const isLocal = hasFlag("--local") || !isRemote;

// Sample data arrays
const sampleDomains = [
  "example.com",
  "mystore.com",
  "techblog.io",
  "portfolio.dev",
  "startup.co",
  "agency.design",
  "ecommerce.shop",
  "news.today",
];

const sampleSiteNames = [
  "Example Website",
  "My Online Store",
  "Tech Blog",
  "Portfolio Site",
  "Startup Landing",
  "Design Agency",
  "E-commerce Shop",
  "News Portal",
];

const samplePages = [
  "/",
  "/about",
  "/contact",
  "/products",
  "/services",
  "/blog",
  "/pricing",
  "/features",
  "/team",
  "/careers",
  "/support",
  "/login",
  "/signup",
  "/checkout",
  "/cart",
];

const sampleReferrers = [
  "https://google.com",
  "https://facebook.com",
  "https://twitter.com",
  "https://linkedin.com",
  "https://reddit.com",
  "https://github.com",
  "https://stackoverflow.com",
  "https://medium.com",
  "https://dev.to",
  "https://hackernews.com",
  "",
  "direct",
];

const sampleBrowsers = [
  "Chrome 120.0.0",
  "Firefox 121.0.0",
  "Safari 17.2.0",
  "Edge 120.0.0",
  "Opera 105.0.0",
];

const sampleOS = [
  "Windows 11",
  "macOS 14.2",
  "Ubuntu 22.04",
  "iOS 17.2",
  "Android 14",
];

const sampleDeviceTypes = ["desktop", "mobile", "tablet"];

const sampleCountries = ["US", "GB", "CA", "DE", "FR", "AU", "JP", "BR"];
const sampleRegions = [
  "California",
  "Texas",
  "New York",
  "London",
  "Ontario",
  "Bavaria",
];
const sampleCities = [
  "San Francisco",
  "Austin",
  "New York",
  "London",
  "Toronto",
  "Munich",
];

const sampleEvents = ["page_view", "form_fill", "phone_call"];

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

// Helper function to get random item from array
function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to generate random timestamp within last N days (returns Unix timestamp in seconds)
function randomTimestamp(daysBack: number): number {
  const now = Math.floor(Date.now() / 1000); // Convert to seconds
  const daysInSeconds = daysBack * 24 * 60 * 60;
  return now - Math.floor(Math.random() * daysInSeconds);
}

// Helper function to generate screen dimensions
function randomScreenDimensions(): { width: number; height: number } {
  const commonResolutions = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 375, height: 667 }, // iPhone
    { width: 414, height: 896 }, // iPhone
    { width: 768, height: 1024 }, // iPad
  ];
  return randomItem(commonResolutions);
}

async function seedData() {
  try {
    console.log("🌱 Seeding database with sample data...");
    console.log(`📊 Target: ${database} (${isLocal ? "local" : "remote"})`);
    console.log(`🏢 Team ID: ${teamId}`);

    if (siteId) {
      console.log(`🎯 Using existing site ID: ${siteId}`);
      console.log(`📈 Events to generate: ${numEvents}`);
    } else {
      console.log(`🌐 Sites to create: ${numSites}`);
      console.log(`📈 Events per site: ${numEvents}`);
    }
    console.log(`📅 Days back: ${numDays}`);

    const createdSites: Array<{
      siteId: number;
      tagId: string;
      name: string;
      domain: string;
    }> = [];

    if (siteId) {
      // Use existing site - fetch its details
      const getSiteSQL = `SELECT site_id, tag_id, name, domain FROM sites WHERE site_id = ${siteId} AND team_id = ${teamId};`;
      const tempFile = join(process.cwd(), `temp_query_${Date.now()}.sql`);
      writeFileSync(tempFile, getSiteSQL);

      try {
        const command = `bunx wrangler d1 execute ${database} --file ${tempFile} ${isLocal ? "--local" : "--remote"} --json --yes`;
        const result = execSync(command, { encoding: "utf8", stdio: "pipe" });
        const jsonResult = JSON.parse(result);

        if (jsonResult[0].results.length === 0) {
          throw new Error(
            `Site ID ${siteId} not found or doesn't belong to team ${teamId}`,
          );
        }

        const site = jsonResult[0].results[0];
        createdSites.push({
          siteId: site.site_id,
          tagId: site.tag_id,
          name: site.name || "Unknown Site",
          domain: site.domain || "unknown.com",
        });

        console.log(`✅ Found existing site: ${site.name} (${site.domain})`);
      } catch (error: any) {
        console.error("❌ Error fetching existing site:", error.message);
        throw error;
      } finally {
        try {
          unlinkSync(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    } else {
      // 1. Create sample sites
      for (let i = 0; i < numSites; i++) {
        const tagId = createId();
        const ridSalt = createId();
        const name = sampleSiteNames[i % sampleSiteNames.length];
        const domain = sampleDomains[i % sampleDomains.length];
        const now = Math.floor(Date.now() / 1000); // Convert to Unix timestamp (seconds)
        const ridSaltExpire = now + 30 * 24 * 60 * 60; // 30 days from now (in seconds)

        const siteSQL = `
INSERT INTO sites (tag_id, track_web_events, team_id, name, domain, gdpr, rid_salt, rid_salt_expire, created_at, updated_at)
VALUES ('${tagId}', 1, ${teamId}, '${name}', '${domain}', 0, '${ridSalt}', ${ridSaltExpire}, ${now}, ${now});
`;
        executeSQL(siteSQL, `Creating site: ${name}`);

        // Get the site ID
        const getSiteIdSQL = `SELECT site_id FROM sites WHERE tag_id = '${tagId}';`;
        const tempFile = join(process.cwd(), `temp_query_${Date.now()}.sql`);
        writeFileSync(tempFile, getSiteIdSQL);

        try {
          const command = `bunx wrangler d1 execute ${database} --file ${tempFile} ${isLocal ? "--local" : "--remote"} --json --yes`;
          const result = execSync(command, { encoding: "utf8", stdio: "pipe" });
          const jsonResult = JSON.parse(result);
          const siteId = jsonResult[0].results[0].site_id;

          createdSites.push({ siteId, tagId, name, domain });
          console.log(`🔍 Created site ID: ${siteId} for ${name}`);
        } catch (error: any) {
          console.error("❌ Error getting site ID:", error.message);
          throw error;
        } finally {
          try {
            unlinkSync(tempFile);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      } // End of for loop
    } // End of else block for creating new sites

    // 2. Generate sample events for each site
    for (const site of createdSites) {
      console.log(`📊 Generating ${numEvents} events for ${site.name}...`);

      const eventBatches = [];
      const batchSize = 50; // Insert events in batches

      for (let i = 0; i < numEvents; i++) {
        const timestamp = randomTimestamp(numDays);
        const page = randomItem(samplePages);
        const referrer = randomItem(sampleReferrers);
        const browser = randomItem(sampleBrowsers);
        const os = randomItem(sampleOS);
        const deviceType = randomItem(sampleDeviceTypes);
        const country = randomItem(sampleCountries);
        const region = randomItem(sampleRegions);
        const city = randomItem(sampleCities);
        const event = randomItem(sampleEvents);
        const { width, height } = randomScreenDimensions();
        const rid = createId(); // Random visitor ID

        const eventSQL = `
('${site.tagId}', ${site.siteId}, ${teamId}, '${event}', '${page}', '${site.domain}${page}', '${referrer}', '${browser}', '${os}', '${deviceType}', '${country}', '${region}', '${city}', ${width}, ${height}, '${rid}', ${timestamp}, ${timestamp})`;

        eventBatches.push(eventSQL);

        // Insert batch when we reach batch size or at the end
        if (eventBatches.length === batchSize || i === numEvents - 1) {
          const batchSQL = `
INSERT INTO site_events (tag_id, site_id, team_id, event, client_page_url, page_url, referer, browser, operating_system, device_type, country, region, city, screen_width, screen_height, rid, created_at, updated_at)
VALUES ${eventBatches.join(",\n")};
`;
          executeSQL(
            batchSQL,
            `Inserting batch of ${eventBatches.length} events for ${site.name}`,
          );
          eventBatches.length = 0; // Clear the batch
        }
      }
    }

    console.log("✅ Data seeding complete!");
    console.log(`
📊 Summary:
  Sites created: ${createdSites.length}
  Total events generated: ${createdSites.length * numEvents}
  Team ID: ${teamId}
  Database: ${database} (${isLocal ? "local" : "remote"})
`);

    console.log(`
🌐 Created sites:
${createdSites.map((site) => `  - ${site.name} (${site.domain}) - Tag ID: ${site.tagId}`).join("\n")}
`);

    console.log(`
🚀 Next steps:
  1. Start the dev server: bun run dev
  2. Login with your user credentials
  3. View the analytics dashboard with sample data
  4. Test the tracking script on your sites
`);
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
}

// Validate required arguments
if (!teamId || isNaN(teamId)) {
  console.error("❌ Error: --team-id is required and must be a number");
  console.log("Use --help for usage information");
  process.exit(1);
}

if (siteId && (isNaN(siteId) || siteId <= 0)) {
  console.error("❌ Error: --site-id must be a positive number");
  process.exit(1);
}

if ((!siteId && numSites <= 0) || numEvents <= 0 || numDays <= 0) {
  console.error(
    "❌ Error: --sites (when not using --site-id), --events, and --days must be positive numbers",
  );
  process.exit(1);
}

if (siteId && numSites !== 3) {
  console.log("ℹ️  Note: --sites parameter is ignored when using --site-id");
}

// Run the seeding
seedData();
