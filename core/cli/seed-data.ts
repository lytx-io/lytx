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
  --site-names <csv>        Comma-separated site names (used in order when creating sites)
  --site-id <id>            Populate existing site ID with events (skips site creation)
  -e, --events <number>     Number of events per site (default: 100)
  --days <number>           Number of days back to generate events (default: 30)
  --dev-url <url>           Base URL for dev server (default: "http://localhost:6123")
  --seed-secret <value>     SEED_DATA_SECRET value for dev bypass (required)
  -h, --help               Show this help message

Example:
  bun run cli/seed-data.ts --team-id 1 --sites 2 --events 50 --seed-secret "$SEED_DATA_SECRET"
  bun run cli/seed-data.ts --team-id 1 --sites 2 --site-names "Site1,Site2" --events 50 --seed-secret "$SEED_DATA_SECRET"
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

const getSiteNamesArg = () => {
  try {
    const value = getArg("--site-names");
    const parsed = value
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    return parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
};

const teamId = getTeamIdArg();
const numSites = getSitesArg();
const numEvents = getEventsArg();
const numDays = getDaysArg();
const siteId = getSiteIdArg();
const customSiteNames = getSiteNamesArg();
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
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://claude.ai",
  "https://gemini.google.com",
  "https://perplexity.ai",
  "https://copilot.microsoft.com",
  "https://poe.com",
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
  { country: "US", region: "Virginia", city: "Ashburn" },
  { country: "US", region: "Oregon", city: "Portland" },
  { country: "US", region: "Texas", city: "Austin" },
  { country: "US", region: "Washington", city: "Seattle" },
  { country: "US", region: "New York", city: "New York" },
  { country: "US", region: "North Carolina", city: "Charlotte" },
  { country: "US", region: "Illinois", city: "Chicago" },
  { country: "US", region: "Florida", city: "Miami" },
  { country: "US", region: "Ohio", city: "Columbus" },
  { country: "US", region: "New Jersey", city: "Newark" },
  { country: "US", region: "Minnesota", city: "Minneapolis" },
  { country: "US", region: "Michigan", city: "Detroit" },
  { country: "US", region: "Maryland", city: "Baltimore" },
  { country: "US", region: "Iowa", city: "Des Moines" },
  { country: "CA", region: "Ontario", city: "Toronto" },
  { country: "CA", region: "Quebec", city: "Montreal" },
  { country: "CA", region: "British Columbia", city: "Vancouver" },
  { country: "GB", region: "England", city: "London" },
  { country: "DE", region: "Saxony", city: "Dresden" },
  { country: "DE", region: "Hesse", city: "Frankfurt" },
  { country: "DE", region: "Lower Saxony", city: "Hanover" },
  { country: "DE", region: "State of Berlin", city: "Berlin" },
  { country: "FR", region: "Ile-de-France", city: "Paris" },
  { country: "FR", region: "Brittany", city: "Rennes" },
  { country: "FR", region: "Grand Est", city: "Strasbourg" },
  { country: "NL", region: "North Holland", city: "Amsterdam" },
  { country: "NL", region: "Overijssel", city: "Zwolle" },
  { country: "BE", region: "Brussels Capital", city: "Brussels" },
  { country: "PL", region: "Mazovia", city: "Warsaw" },
  { country: "CH", region: "Ticino", city: "Lugano" },
  { country: "SE", region: "Stockholm", city: "Stockholm" },
  { country: "FI", region: "Uusimaa", city: "Helsinki" },
  { country: "DK", region: "Capital Region", city: "Copenhagen" },
  { country: "PT", region: "Lisbon", city: "Lisbon" },
  { country: "IT", region: "Lombardy", city: "Milan" },
  { country: "IT", region: "Sicily", city: "Palermo" },
  { country: "IE", region: "Leinster", city: "Dublin" },
  { country: "ES", region: "Madrid", city: "Madrid" },
  { country: "CN", region: "Beijing", city: "Beijing" },
  { country: "CN", region: "Shanghai", city: "Shanghai" },
  { country: "CN", region: "Hebei", city: "Shijiazhuang" },
  { country: "CN", region: "Fujian", city: "Fuzhou" },
  { country: "CN", region: "Tianjin", city: "Tianjin" },
  { country: "CN", region: "Xinjiang", city: "Urumqi" },
  { country: "IN", region: "Telangana", city: "Hyderabad" },
  { country: "IN", region: "Punjab", city: "Ludhiana" },
  { country: "IN", region: "Maharashtra", city: "Mumbai" },
  { country: "IN", region: "Tamil Nadu", city: "Chennai" },
  { country: "IN", region: "Madhya Pradesh", city: "Bhopal" },
  { country: "IN", region: "Uttarakhand", city: "Dehradun" },
  { country: "VN", region: "Vinh Long", city: "Vinh Long" },
  { country: "VN", region: "Thanh Hoa Province", city: "Thanh Hoa" },
  { country: "VN", region: "Ninh Binh", city: "Ninh Binh" },
  { country: "VN", region: "Quang Tri", city: "Dong Ha" },
  { country: "BD", region: "Chittagong", city: "Chittagong" },
  { country: "BD", region: "Sylhet Division", city: "Sylhet" },
  { country: "BD", region: "Rajshahi Division", city: "Rajshahi" },
  { country: "KR", region: "Seoul", city: "Seoul" },
  { country: "KR", region: "Gyeonggi-do", city: "Suwon" },
  { country: "JP", region: "Tokyo", city: "Tokyo" },
  { country: "TW", region: "Taiwan", city: "Taipei" },
  { country: "SG", region: "Singapore", city: "Singapore" },
  { country: "MY", region: "Selangor", city: "Shah Alam" },
  { country: "ID", region: "North Sumatra", city: "Medan" },
  { country: "PH", region: "Metro Manila", city: "Manila" },
  { country: "TH", region: "Bangkok", city: "Bangkok" },
  { country: "AU", region: "New South Wales", city: "Sydney" },
  { country: "AU", region: "Victoria", city: "Melbourne" },
  { country: "NZ", region: "Auckland", city: "Auckland" },
  { country: "AQ", region: "Ross Dependency", city: "McMurdo Station" },
  { country: "BR", region: "Sao Paulo", city: "Sao Paulo" },
  { country: "BR", region: "Rio de Janeiro", city: "Rio de Janeiro" },
  { country: "BR", region: "Rio Grande do Sul", city: "Porto Alegre" },
  { country: "BR", region: "Minas Gerais", city: "Belo Horizonte" },
  { country: "BR", region: "Goias", city: "Goiania" },
  { country: "BR", region: "Paraiba", city: "Joao Pessoa" },
  { country: "MX", region: "Nuevo Leon", city: "Monterrey" },
  { country: "MX", region: "Puebla", city: "Puebla" },
  { country: "MX", region: "Queretaro", city: "Queretaro" },
  { country: "MX", region: "Veracruz", city: "Veracruz" },
  { country: "MX", region: "Mexico", city: "Mexico City" },
  { country: "CO", region: "Bogota D.C.", city: "Bogota" },
  { country: "AR", region: "Buenos Aires F.D.", city: "Buenos Aires" },
  { country: "EC", region: "Pichincha", city: "Quito" },
  { country: "PA", region: "Panama", city: "Panama City" },
  { country: "JM", region: "Kingston", city: "Kingston" },
  { country: "TT", region: "Port of Spain", city: "Port of Spain" },
  { country: "DO", region: "Distrito Nacional", city: "Santo Domingo" },
  { country: "PR", region: "San Juan", city: "San Juan" },
  { country: "BS", region: "New Providence", city: "Nassau" },
  { country: "BB", region: "Saint Michael", city: "Bridgetown" },
  { country: "CU", region: "La Habana", city: "Havana" },
  { country: "VE", region: "Zulia", city: "Maracaibo" },
  { country: "ZA", region: "Western Cape", city: "Cape Town" },
  { country: "ZA", region: "Gauteng", city: "Johannesburg" },
  { country: "ZA", region: "KwaZulu-Natal", city: "Durban" },
  { country: "SA", region: "Riyadh Region", city: "Riyadh" },
  { country: "SA", region: "Mecca Region", city: "Jeddah" },
  { country: "IL", region: "Tel Aviv", city: "Tel Aviv" },
  { country: "JO", region: "Amman", city: "Amman" },
  { country: "TR", region: "Istanbul", city: "Istanbul" },
  { country: "TN", region: "Tunis Governorate", city: "Tunis" },
  { country: "DZ", region: "Oran", city: "Oran" },
  { country: "DZ", region: "M'Sila", city: "M'Sila" },
  { country: "IQ", region: "Nineveh", city: "Mosul" },
  { country: "LB", region: "Liban-Nord", city: "Tripoli" },
  { country: "KG", region: "Bishkek", city: "Bishkek" },
  { country: "UZ", region: "Tashkent", city: "Tashkent" },
  { country: "KE", region: "Meru County", city: "Meru" },
  { country: "KE", region: "Nairobi County", city: "Nairobi" },
  { country: "KE", region: "Mombasa County", city: "Mombasa" },
  { country: "NG", region: "Lagos", city: "Lagos" },
  { country: "NG", region: "Federal Capital Territory", city: "Abuja" },
  { country: "NG", region: "Rivers", city: "Port Harcourt" },
  { country: "GH", region: "Greater Accra", city: "Accra" },
  { country: "GH", region: "Ashanti", city: "Kumasi" },
  { country: "AE", region: "Dubai", city: "Dubai" },
  { country: "RO", region: "Bucharest", city: "Bucharest" },
  { country: "LT", region: "Vilnius", city: "Vilnius" },
  { country: "AZ", region: "Baku", city: "Baku" },
  { country: "AL", region: "Vlore County", city: "Vlore" },
  { country: "GT", region: "Guatemala", city: "Guatemala City" },
  { country: "EG", region: "Cairo", city: "Cairo" },
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
      if (customSiteNames) {
        console.log(`🏷️  Custom site names: ${customSiteNames.join(", ")}`);
      }
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
        const name = customSiteNames?.[i] || sampleSiteNames[i % sampleSiteNames.length];
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

if (siteId && customSiteNames) {
  console.log("ℹ️  Note: --site-names parameter is ignored when using --site-id");
}

if (!siteId && customSiteNames && customSiteNames.length < numSites) {
  console.error(
    `❌ Error: --site-names provided ${customSiteNames.length} name(s), but --sites is ${numSites}. Provide at least ${numSites} names.`,
  );
  process.exit(1);
}

if (!siteId && customSiteNames && customSiteNames.length > numSites) {
  console.log(`ℹ️  Note: --site-names provided ${customSiteNames.length} names; only the first ${numSites} will be used.`);
}

// Run the seeding
seedData();
