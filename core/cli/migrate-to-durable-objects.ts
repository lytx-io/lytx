#!/usr/bin/env bun
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
Usage: bun run cli/migrate-to-durable-objects.ts [options]

Description:
  Migrate existing siteEvents data from D1/Postgres databases to per-site durable objects.
  This script coordinates migration by calling a temporary migration worker that has access
  to the Cloudflare Workers environment and durable objects.

Prerequisites:
  1. Deploy or run the migration worker:
     - Local: wrangler dev --config cli/wrangler-migration.jsonc
     - Remote: wrangler deploy --config cli/wrangler-migration.jsonc
  2. Update the worker URL in this script if needed

Options:
  -s, --site-id <id>        Migrate specific site ID (required unless --all-sites)
  -t, --team-id <id>        Migrate all sites for team ID (use with --all-sites)
  -d, --database <name>     D1 database name (default: "lytx_core_db")
  --local                   Use local database (default: true)
  --remote                  Use remote database (default: false)
  --from-postgres <url>     Migrate from PostgreSQL database (provide connection string)
  --all-sites               Migrate all sites for the specified team
  --batch-size <size>       Events per batch (default: 50)
  --dry-run                 Show what would be migrated without actually migrating
  --verify                  Verify migration by comparing record counts
  --cleanup                 Remove original data after successful migration (DANGEROUS)
  --force                   Skip confirmation prompts
  -h, --help               Show this help message

Migration Sources:
  1. D1 Database (default):
     Migrates siteEvents from the local D1 database to durable objects
     
  2. PostgreSQL Database:
     Use --from-postgres with connection string to migrate from Postgres

Examples:
  # Migrate specific site from D1 (local)
  bun run cli/migrate-to-durable-objects.ts --site-id 123 --local
  
  # Migrate all sites for a team from D1 (remote)
  bun run cli/migrate-to-durable-objects.ts --team-id 5 --all-sites --remote
  
  # Migrate from PostgreSQL database
  bun run cli/migrate-to-durable-objects.ts --site-id 123 --from-postgres "postgresql://user:pass@host:5432/db"
  
  # Dry run to see what would be migrated
  bun run cli/migrate-to-durable-objects.ts --site-id 123 --dry-run
  
  # Migrate with verification and cleanup
  bun run cli/migrate-to-durable-objects.ts --site-id 123 --verify --cleanup --force

Safety Features:
  - Batch processing to avoid memory issues
  - Data validation before migration
  - Verification option to compare record counts
  - Dry run mode to preview migration
  - Rollback capability (keeps original data by default)
`);
  process.exit(0);
}

// CLI argument parsing
const getSiteIdArg = () => {
  try {
    return parseInt(getArg("--site-id"));
  } catch {
    try {
      return parseInt(getArg("-s"));
    } catch {
      return null;
    }
  }
};

const getTeamIdArg = () => {
  try {
    return parseInt(getArg("--team-id"));
  } catch {
    try {
      return parseInt(getArg("-t"));
    } catch {
      return null;
    }
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

const getFromPostgresArg = () => {
  try {
    return getArg("--from-postgres");
  } catch {
    return null;
  }
};

const getBatchSizeArg = () => {
  try {
    return parseInt(getArg("--batch-size"));
  } catch {
    return 50;
  }
};

const siteId = getSiteIdArg();
const teamId = getTeamIdArg();
const database = getDatabaseArg();
const fromPostgres = getFromPostgresArg();
const batchSize = getBatchSizeArg();
const isRemote = hasFlag("--remote");
const isLocal = hasFlag("--local") || !isRemote;
const allSites = hasFlag("--all-sites");
const dryRun = hasFlag("--dry-run");
const verify = hasFlag("--verify");
const cleanup = hasFlag("--cleanup");
const force = hasFlag("--force");

// Validation
if (!siteId && !allSites) {
  console.error("❌ Error: Either --site-id or --all-sites is required");
  process.exit(1);
}

if (allSites && !teamId) {
  console.error("❌ Error: --team-id is required when using --all-sites");
  process.exit(1);
}

if (cleanup && !force) {
  console.error("❌ Error: --cleanup requires --force flag for safety");
  process.exit(1);
}

// Event interface for migration
interface MigrationEvent {
  id?: number;
  team_id?: number;
  site_id?: number;
  bot_data?: object;
  browser?: string;
  city?: string;
  client_page_url?: string;
  country?: string;
  created_at?: Date;
  updated_at?: Date;
  custom_data?: object;
  device_type?: string;
  event: string;
  operating_system?: string;
  page_url?: string;
  postal?: string;
  query_params?: object;
  referer?: string;
  region?: string;
  rid?: string;
  screen_height?: number;
  screen_width?: number;
  tag_id: string;
}

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

// Helper function to query D1 database
async function queryD1(sql: string): Promise<any[]> {
  const tempFile = join(process.cwd(), `temp_query_${Date.now()}.sql`);
  writeFileSync(tempFile, sql);

  try {
    const command = `bunx wrangler d1 execute ${database} --file ${tempFile} ${isLocal ? "--local" : "--remote"} --json --yes`;
    const result = execSync(command, { encoding: "utf8", stdio: "pipe" });

    // Extract JSON from wrangler output
    const jsonStart = result.indexOf("[");
    const jsonEnd = result.lastIndexOf("]") + 1;

    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error("No JSON found in wrangler output");
    }

    const jsonString = result.substring(jsonStart, jsonEnd);
    const jsonResult = JSON.parse(jsonString);

    if (!jsonResult || !jsonResult[0] || !jsonResult[0].results) {
      throw new Error(`Unexpected response format from wrangler`);
    }

    return jsonResult[0].results;
  } catch (error: any) {
    console.error("❌ Error querying D1:", error.message);
    throw error;
  } finally {
    try {
      unlinkSync(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Get sites to migrate
async function getSitesToMigrate(): Promise<Array<{ site_id: number; tag_id: string; name?: string }>> {
  if (siteId) {
    // Single site migration
    const sites = await queryD1(`SELECT site_id, tag_id, name FROM sites WHERE site_id = ${siteId};`);
    if (sites.length === 0) {
      throw new Error(`Site ID ${siteId} not found`);
    }
    return sites;
  } else if (allSites && teamId) {
    // All sites for team migration
    const sites = await queryD1(`SELECT site_id, tag_id, name FROM sites WHERE team_id = ${teamId};`);
    if (sites.length === 0) {
      throw new Error(`No sites found for team ID ${teamId}`);
    }
    return sites;
  }
  return [];
}

// Read events from D1 database
async function readEventsFromD1(siteId: number): Promise<MigrationEvent[]> {
  console.log(`📖 Reading events from D1 for site ${siteId}...`);
  
  const events = await queryD1(`
    SELECT * FROM site_events 
    WHERE site_id = ${siteId} 
    ORDER BY created_at ASC
  `);

  console.log(`✅ Found ${events.length} events in D1 for site ${siteId}`);
  return events;
}

// Read events from PostgreSQL database
async function readEventsFromPostgres(siteId: number, connectionString: string): Promise<MigrationEvent[]> {
  console.log(`📖 Reading events from PostgreSQL for site ${siteId}...`);

  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    const events = await db
      .select()
      .from(pgSiteEvents)
      .where(eq(pgSiteEvents.site_id, siteId))
      .orderBy(pgSiteEvents.created_at);

    console.log(`✅ Found ${events.length} events in PostgreSQL for site ${siteId}`);
    
    await sql.end();
    return events as MigrationEvent[];
  } catch (error: any) {
    await sql.end();
    throw new Error(`Failed to read from PostgreSQL: ${error.message}`, { cause: error });
  }
}

// Transform events for durable object (remove team_id, site_id)
function transformEventsForDurableObject(events: MigrationEvent[]): any[] {
  return events.map(event => ({
    bot_data: event.bot_data,
    browser: event.browser,
    city: event.city,
    client_page_url: event.client_page_url,
    country: event.country,
    createdAt: event.created_at || new Date(),
    updatedAt: event.updated_at || new Date(),
    custom_data: event.custom_data,
    device_type: event.device_type,
    event: event.event,
    operating_system: event.operating_system,
    page_url: event.page_url,
    postal: event.postal,
    query_params: event.query_params,
    referer: event.referer,
    region: event.region,
    rid: event.rid,
    screen_height: event.screen_height,
    screen_width: event.screen_width,
    tag_id: event.tag_id,
  }));
}

// Write events to durable object using the migration worker
async function writeEventsToDurableObject(siteId: number, events: any[]): Promise<void> {
  console.log(`📝 Writing ${events.length} events to durable object Site-${siteId}...`);
  
  try {
    // Use the migration worker endpoint
    const workerUrl = isLocal 
      ? 'http://localhost:8787'  // Local migration worker
      : 'https://migration.lytx.workers.dev';  // Deployed migration worker
    
    // Call the migration worker's migrate-site endpoint
    const response = await fetch(`${workerUrl}/migrate-site`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        siteId,
        batchSize: Math.min(events.length, batchSize),
        dryRun: false,
        verify: false
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json() as any;
    
    if (!result.migration?.success) {
      const errors = result.migration?.errors?.join(', ') || 'Unknown error';
      throw new Error(`Migration failed: ${errors}`);
    }
    
    console.log(`✅ Successfully migrated ${result.migration.migratedEvents} events to durable object Site-${siteId}`);
    
  } catch (error: any) {
    console.error(`❌ Failed to migrate to durable object Site-${siteId}:`, error.message);
    throw error;
  }
}

// Verify migration using the migration worker
async function verifyMigration(siteId: number, originalCount: number): Promise<boolean> {
  console.log(`🔍 Verifying migration for site ${siteId}...`);
  
  try {
    // Use the migration worker endpoint
    const workerUrl = isLocal 
      ? 'http://localhost:8787'  // Local migration worker
      : 'https://migration.lytx.workers.dev';  // Deployed migration worker
    
    // Call the migration worker's verify endpoint
    const response = await fetch(`${workerUrl}/verify-site/${siteId}?expectedCount=${originalCount}`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json() as { success: boolean; actualCount: number; expectedCount: number };
    
    if (result.success) {
      console.log(`✅ Verification passed: ${result.actualCount} events in durable object (expected: ${result.expectedCount})`);
      return true;
    } else {
      console.error(`❌ Verification failed: Expected ${result.expectedCount}, found ${result.actualCount}`);
      return false;
    }
    
  } catch (error: any) {
    console.error(`❌ Verification failed for site ${siteId}:`, error.message);
    return false;
  }
}

// Clean up original data
async function cleanupOriginalData(siteId: number): Promise<void> {
  if (!cleanup) return;
  
  console.log(`🧹 Cleaning up original data for site ${siteId}...`);
  
  if (fromPostgres) {
    // TODO: Delete from PostgreSQL
    console.log(`Would delete PostgreSQL data for site ${siteId}`);
  } else {
    // Delete from D1
    executeSQL(`DELETE FROM site_events WHERE site_id = ${siteId};`, `Cleaning up D1 data for site ${siteId}`);
  }
}

// Main migration function
async function migrateSite(site: { site_id: number; tag_id: string; name?: string }): Promise<void> {
  const { site_id, tag_id, name } = site;
  
  console.log(`\n🚀 Starting migration for site ${site_id} (${name || 'Unnamed'}) - Tag: ${tag_id}`);
  
  try {
    // Read events from source
    let events: MigrationEvent[];
    if (fromPostgres) {
      events = await readEventsFromPostgres(site_id, fromPostgres);
    } else {
      events = await readEventsFromD1(site_id);
    }
    
    if (events.length === 0) {
      console.log(`ℹ️  No events found for site ${site_id}, skipping...`);
      return;
    }
    
    // Transform events for durable object
    const transformedEvents = transformEventsForDurableObject(events);
    
    if (dryRun) {
      console.log(`🔍 DRY RUN: Would migrate ${transformedEvents.length} events for site ${site_id}`);
      console.log(`   Sample event:`, JSON.stringify(transformedEvents[0], null, 2));
      return;
    }
    
    // Process in batches
    for (let i = 0; i < transformedEvents.length; i += batchSize) {
      const batch = transformedEvents.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(transformedEvents.length / batchSize);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} events)`);
      await writeEventsToDurableObject(site_id, batch);
    }
    
    // Verify migration if requested
    if (verify) {
      const verified = await verifyMigration(site_id, events.length);
      if (!verified) {
        throw new Error(`Migration verification failed for site ${site_id}`);
      }
    }
    
    // Cleanup original data if requested
    await cleanupOriginalData(site_id);
    
    console.log(`✅ Migration completed successfully for site ${site_id}`);
    
  } catch (error) {
    console.error(`❌ Migration failed for site ${site_id}:`, error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log("🚀 Starting durable objects migration...");
    console.log(`📊 Source: ${fromPostgres ? 'PostgreSQL' : 'D1'} (${isLocal ? 'local' : 'remote'})`);
    console.log(`📦 Batch size: ${batchSize}`);
    console.log(`🔍 Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
    
    // Get sites to migrate
    const sites = await getSitesToMigrate();
    console.log(`📋 Found ${sites.length} site(s) to migrate`);
    
    // Confirmation prompt (unless forced)
    if (!force && !dryRun) {
      console.log(`\n⚠️  About to migrate ${sites.length} site(s). This will:`);
      console.log(`   - Read events from ${fromPostgres ? 'PostgreSQL' : 'D1'}`);
      console.log(`   - Write events to durable objects`);
      if (verify) console.log(`   - Verify migration by comparing counts`);
      if (cleanup) console.log(`   - DELETE original data after migration`);
      console.log(`\nPress Ctrl+C to cancel, or any key to continue...`);
      
      // Wait for user input
      process.stdin.setRawMode(true);
      process.stdin.resume();
      await new Promise(resolve => process.stdin.once('data', resolve));
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
    
    // Migrate each site
    let successCount = 0;
    let failureCount = 0;
    
    for (const site of sites) {
      try {
        await migrateSite(site);
        successCount++;
      } catch (error) {
        console.error(`Failed to migrate site ${site.site_id}:`, error);
        failureCount++;
      }
    }
    
    // Summary
    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   📋 Total: ${sites.length}`);
    
    if (failureCount > 0) {
      console.log(`\n⚠️  Some migrations failed. Check the logs above for details.`);
      process.exit(1);
    } else {
      console.log(`\n🎉 All migrations completed successfully!`);
    }
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
main();