#!/usr/bin/env bun
import { createId } from "@paralleldrive/cuid2";

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
Usage: bun run cli/seed-data.ts [options]

Requires the dev server to be running (bun run dev).

Options:
  -t, --team-id <id>        Team ID to create sites for (required)
  -s, --sites <number>      Number of sites to create (default: 3)
  --site-id <id>            Populate existing site ID with events (skips site creation)
  -e, --events <number>     Number of events per site (default: 100)
  --days <number>           Number of days back to generate events (default: 30)
  --dev-url <url>           Base URL for dev server (default: "http://localhost:6123")
  --seed-secret <value>     SEED_DATA_SECRET value for dev bypass (required)
  -h, --help               Show this help message

Example:
  bun run cli/seed-data.ts --team-id 1 --sites 2 --events 50 --seed-secret "$SEED_DATA_SECRET"
  bun run cli/seed-data.ts --team-id 1 --site-id 3 --events 100 --seed-secret "$SEED_DATA_SECRET"
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
const siteId = getSiteIdArg();
const devUrl = hasFlag("--dev-url") ? getArg("--dev-url") : "http://localhost:6123";
const seedSecret = hasFlag("--seed-secret") ? getArg("--seed-secret") : "";

if (!seedSecret) {
  console.error("❌ Error: --seed-secret is required.");
  process.exit(1);
}

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

const sampleGeo = [
  { country: "US", region: "California", city: "San Francisco" },
  { country: "US", region: "Texas", city: "Austin" },
  { country: "US", region: "New York", city: "New York" },
  { country: "GB", region: "London", city: "London" },
  { country: "CA", region: "Ontario", city: "Toronto" },
  { country: "DE", region: "Bavaria", city: "Munich" },
  { country: "FR", region: "Ile-de-France", city: "Paris" },
  { country: "AU", region: "New South Wales", city: "Sydney" },
  { country: "JP", region: "Tokyo", city: "Tokyo" },
  { country: "BR", region: "Sao Paulo", city: "Sao Paulo" },
];

const sampleEvents = ["page_view", "form_fill", "phone_call"];

// Helper function to get random item from array
function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to generate random timestamp within last N days (returns Unix timestamp in ms)
function randomTimestamp(daysBack: number): number {
  const now = Date.now();
  const daysInMs = daysBack * 24 * 60 * 60 * 1000;
  return now - Math.floor(Math.random() * daysInMs);
}

function normalizeTimestampMs(timestamp: number): number {
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
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

// API helper functions
async function apiRequest(path: string, options: RequestInit = {}) {
  const url = `${devUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-seed-secret": seedSecret,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed (${response.status}): ${text}`);
  }

  return response;
}

async function checkTeamExists(teamId: number): Promise<boolean> {
  try {
    await apiRequest(`/api/seed/team/${teamId}`);
    return true;
  } catch (error: any) {
    if (error.message.includes("404")) {
      return false;
    }
    throw error;
  }
}

type SiteResponse = {
  site_id: number;
  uuid: string;
  tag_id: string;
  name: string | null;
  domain: string | null;
  site_db_adapter: string | null;
};

type SeedEventsResponse = {
  success: boolean;
  inserted?: number;
  error?: string;
};

async function getSiteById(siteId: number, teamId: number): Promise<SiteResponse> {
  const response = await apiRequest(`/api/seed/site/${siteId}?teamId=${teamId}`);
  return response.json() as Promise<SiteResponse>;
}

async function createSite(teamId: number, name: string, domain: string): Promise<SiteResponse> {
  const response = await apiRequest("/api/seed/site", {
    method: "POST",
    body: JSON.stringify({ teamId, name, domain }),
  });
  return response.json() as Promise<SiteResponse>;
}

async function seedEvents(siteId: number, teamId: number, events: Array<Record<string, unknown>>): Promise<SeedEventsResponse> {
  const response = await apiRequest(`/api/seed/events/${siteId}?teamId=${teamId}`, {
    method: "POST",
    body: JSON.stringify(events),
  });
  return response.json() as Promise<SeedEventsResponse>;
}

function buildEventPayload(site: { tag_id: string; domain: string }, timestampSeconds: number) {
  const page = randomItem(samplePages);
  const referrer = randomItem(sampleReferrers);
  const browser = randomItem(sampleBrowsers);
  const os = randomItem(sampleOS);
  const deviceType = randomItem(sampleDeviceTypes);
  const geo = randomItem(sampleGeo);
  const event = randomItem(sampleEvents);
  const { width, height } = randomScreenDimensions();
  const rid = createId();

  return {
    tag_id: site.tag_id,
    event,
    client_page_url: page,
    page_url: `${site.domain}${page}`,
    referer: referrer,
    browser,
    operating_system: os,
    device_type: deviceType,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    screen_width: width,
    screen_height: height,
    rid,
    createdAt: new Date(timestampSeconds * 1000).toISOString(),
    updatedAt: new Date(timestampSeconds * 1000).toISOString(),
  };
}

async function seedData() {
  try {
    console.log("🌱 Seeding database with sample data...");
    console.log(`🌐 Dev server: ${devUrl}`);
    console.log(`🏢 Team ID: ${teamId}`);

    // Verify team exists
    console.log("📋 Verifying team exists...");
    const teamExists = await checkTeamExists(teamId);
    if (!teamExists) {
      console.error(`❌ Team ${teamId} not found. Please create the team first using init-db.ts`);
      process.exit(1);
    }
    console.log("✅ Team verified");

    if (siteId) {
      console.log(`🎯 Using existing site ID: ${siteId}`);
      console.log(`📈 Events to generate: ${numEvents}`);
    } else {
      console.log(`🌐 Sites to create: ${numSites}`);
      console.log(`📈 Events per site: ${numEvents}`);
    }
    console.log(`📅 Days back: ${numDays}`);

    const createdSites: Array<{
      site_id: number;
      tag_id: string;
      name: string;
      domain: string;
    }> = [];

    if (siteId) {
      // Use existing site - fetch its details
      console.log(`📡 Fetching site ${siteId}...`);
      const site = await getSiteById(siteId, teamId);
      createdSites.push({
        site_id: site.site_id,
        tag_id: site.tag_id,
        name: site.name || "Unknown Site",
        domain: site.domain || "unknown.com",
      });
      console.log(`✅ Found existing site: ${site.name} (${site.domain})`);
    } else {
      // Create sample sites
      for (let i = 0; i < numSites; i++) {
        const name = sampleSiteNames[i % sampleSiteNames.length];
        const domain = sampleDomains[i % sampleDomains.length];

        console.log(`📡 Creating site: ${name}...`);
        const site = await createSite(teamId, name, domain);
        
        createdSites.push({
          site_id: site.site_id,
          tag_id: site.tag_id,
          name: site.name || name,
          domain: site.domain || domain,
        });
        console.log(`✅ Created site ID: ${site.site_id} for ${name}`);
      }
    }

    // Generate sample events for each site
    for (const site of createdSites) {
      console.log(`📊 Generating ${numEvents} events for ${site.name}...`);

      // SQLite has a ~999 variable limit per query, each event has ~16 fields
      // So batch size of 25 = ~400 variables, safely under the limit
      const batchSize = 25;
      let eventBatch: Array<Record<string, unknown>> = [];

      for (let i = 0; i < numEvents; i++) {
        const timestamp = normalizeTimestampMs(randomTimestamp(numDays));
        const timestampSeconds = Math.floor(timestamp / 1000);

        eventBatch.push(buildEventPayload(site, timestampSeconds));

        if (eventBatch.length === batchSize || i === numEvents - 1) {
          const result = await seedEvents(site.site_id, teamId, eventBatch);
          console.log(`  ✅ Inserted batch of ${eventBatch.length} events (total: ${result.inserted || eventBatch.length})`);
          eventBatch = [];
        }
      }
    }

    console.log("\n✅ Data seeding complete!");
    console.log(`
📊 Summary:
  Sites: ${createdSites.length}
  Total events generated: ${createdSites.length * numEvents}
  Team ID: ${teamId}
  Dev server: ${devUrl}
`);

    console.log(`
🌐 Created/seeded sites:
${createdSites.map((site) => `  - ${site.name} (${site.domain}) - Tag ID: ${site.tag_id}`).join("\n")}
`);

    console.log(`
🚀 Next steps:
  1. Login with your user credentials
  2. View the analytics dashboard with sample data
  3. Test the tracking script on your sites
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
