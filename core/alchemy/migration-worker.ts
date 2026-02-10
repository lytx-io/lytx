/**
 * Migration Worker - Runs in Workers environment with durable object access
 * 
 * This worker performs the actual migration from Postgres to durable objects.
 * It has access to the SITE_DURABLE_OBJECT binding and can write data.
 */

import { DurableObject } from "cloudflare:workers";
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { siteEvents, sites } from '../db/postgres/schema';
import { eq } from 'drizzle-orm';
import type { SiteEventInput } from '../src/session/siteSchema';

// Import the SiteDurableObject class
export { SiteDurableObject } from '../src/session/siteDurableObject';

/**
 * Write events to a site's durable object
 */
async function writeToDurableObject(
  siteId: number,
  events: SiteEventInput[],
  env: any
): Promise<{ success: boolean; inserted?: number; error?: string }> {
  try {
    // Get the durable object for this site
    const durableObjectId = env.SITE_DURABLE_OBJECT.idFromName(`Site-${siteId}`);
    const durableObject = env.SITE_DURABLE_OBJECT.get(durableObjectId);
    
    // Make request to durable object
    const response = await durableObject.fetch('https://durable-object/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(events)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Durable object write failed: ${response.status} ${response.statusText} - ${errorText}`);
      return { 
        success: false, 
        error: `Write failed: ${response.status} ${response.statusText}` 
      };
    }
    
    const result = await response.json() as { success: boolean; inserted?: number; error?: string };
    return result;
  } catch (error) {
    console.error('Error writing to durable object:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Check health of a site's durable object
 */
async function checkDurableObjectHealth(
  siteId: number,
  env: any
): Promise<{ status: string; siteId: number; totalEvents: number; timestamp: string } | null> {
  try {
    // Get the durable object for this site
    const durableObjectId = env.SITE_DURABLE_OBJECT.idFromName(`Site-${siteId}`);
    const durableObject = env.SITE_DURABLE_OBJECT.get(durableObjectId);
    
    // Make health check request
    const response = await durableObject.fetch('https://durable-object/health');
    
    if (!response.ok) {
      console.error(`Durable object health check failed: ${response.status} ${response.statusText}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error checking durable object health:', error);
    return null;
  }
}

interface MigrationResult {
  siteId: number;
  success: boolean;
  totalEvents: number;
  migratedEvents: number;
  batches: number;
  errors: string[];
}

/**
 * Transform D1 events to durable object format
 */
function transformEventsForDurableObject(events: any[]): SiteEventInput[] {
  return events.map(event => ({
    bot_data: event.bot_data,
    browser: event.browser,
    city: event.city,
    client_page_url: event.client_page_url,
    country: event.country,
    createdAt: event.createdAt ? new Date(event.createdAt) : new Date(),
    updatedAt: event.updatedAt ? new Date(event.updatedAt) : new Date(),
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

/**
 * Migrate a single site's events
 */
async function migrateSiteEvents(
  siteId: number,
  env: any,
  config: {
    batchSize: number;
    dryRun: boolean;
    verify: boolean;
    recordLimit?: number;
  }
): Promise<MigrationResult> {
  // Connect to Postgres using DATABASE_URL
  const sql = postgres(env.DATABASE_URL);
  const db = drizzle(sql);
  const errors: string[] = [];
  
  console.log(`\n🚀 Starting migration for site ${siteId}...`);
  
  try {
    // Get events for this site from Postgres (with optional limit for testing)
    const baseQuery = db
      .select()
      .from(siteEvents)
      .where(eq(siteEvents.site_id, siteId))
      .orderBy(siteEvents.created_at);
    
    const events = config.recordLimit 
      ? await baseQuery.limit(config.recordLimit)
      : await baseQuery;
    
    if (config.recordLimit) {
      console.log(`📊 Limited to ${config.recordLimit} records for testing`);
    }

    console.log(`📖 Found ${events.length} events for site ${siteId}`);

    if (events.length === 0) {
      return {
        siteId,
        success: true,
        totalEvents: 0,
        migratedEvents: 0,
        batches: 0,
        errors: []
      };
    }

    // Transform events for durable object
    const transformedEvents = transformEventsForDurableObject(events);

    if (config.dryRun) {
      console.log(`🔍 DRY RUN: Would migrate ${transformedEvents.length} events for site ${siteId}`);
      console.log(`   Sample event:`, JSON.stringify(transformedEvents[0], null, 2));
      return {
        siteId,
        success: true,
        totalEvents: events.length,
        migratedEvents: 0,
        batches: Math.ceil(events.length / config.batchSize),
        errors: []
      };
    }

    // Process in batches
    let migratedCount = 0;
    const totalBatches = Math.ceil(transformedEvents.length / config.batchSize);

    for (let i = 0; i < transformedEvents.length; i += config.batchSize) {
      const batch = transformedEvents.slice(i, i + config.batchSize);
      const batchNumber = Math.floor(i / config.batchSize) + 1;

      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} events)`);

      try {
        const result = await writeToDurableObject(siteId, batch, env);
        
        if (result.success) {
          migratedCount += result.inserted || batch.length;
          console.log(`✅ Batch ${batchNumber} completed: ${result.inserted || batch.length} events`);
        } else {
          const error = `Batch ${batchNumber}: ${result.error}`;
          errors.push(error);
          console.error(`❌ ${error}`);
        }
      } catch (error) {
        const errorMsg = `Batch ${batchNumber} failed: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    // Verify if requested
    if (config.verify && errors.length === 0) {
      console.log(`🔍 Verifying migration for site ${siteId}...`);
      const health = await checkDurableObjectHealth(siteId, env);
      
      if (!health) {
        errors.push('Verification failed: Could not get health status');
      } else if (health.totalEvents !== events.length) {
        errors.push(`Verification failed: Expected ${events.length}, found ${health.totalEvents}`);
      } else {
        console.log(`✅ Verification passed: ${health.totalEvents} events in durable object`);
      }
    }

    return {
      siteId,
      success: errors.length === 0,
      totalEvents: events.length,
      migratedEvents: migratedCount,
      batches: totalBatches,
      errors
    };

  } catch (error) {
    const errorMsg = `Migration failed for site ${siteId}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`❌ ${errorMsg}`);
    
    return {
      siteId,
      success: false,
      totalEvents: 0,
      migratedEvents: 0,
      batches: 0,
      errors: [errorMsg]
    };
  }
}

/**
 * Worker export - handles migration requests
 */
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/migrate' && request.method === 'POST') {
      try {
        // Get configuration from environment variables
        const siteId = env.SITE_ID ? parseInt(env.SITE_ID) : null;
        const teamId = env.TEAM_ID ? parseInt(env.TEAM_ID) : null;
        const batchSize = env.BATCH_SIZE ? parseInt(env.BATCH_SIZE) : 50;
        const allSites = env.ALL_SITES === 'true';
        const dryRun = env.DRY_RUN === 'true';
        const verify = env.VERIFY === 'true';
        const recordLimit = env.RECORD_LIMIT ? parseInt(env.RECORD_LIMIT) : undefined;

        console.log('🚀 Starting durable objects migration...');
        console.log(`📦 Batch size: ${batchSize}`);
        console.log(`🔍 Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
        
        // Connect to Postgres
        const sql = postgres(env.DATABASE_URL);
        const db = drizzle(sql);
        
        // Get sites to migrate
        let sitesToMigrate: Array<{ site_id: number; tag_id: string; domain: string | null }> = [];
        
        if (siteId) {
          // Single site migration - look for site by site_id
          const siteResults = await db
            .select()
            .from(sites)
            .where(eq(sites.site_id, siteId));
          
          if (siteResults.length === 0) {
            throw new Error(`Site ID ${siteId} not found in Postgres`);
          }
          sitesToMigrate = siteResults;
        } else if (allSites && teamId) {
          // All sites for team migration - look for sites by account_id (team)
          const siteResults = await db
            .select()
            .from(sites)
            .where(eq(sites.account_id, teamId));
          
          if (siteResults.length === 0) {
            throw new Error(`No sites found for team ID ${teamId} in Postgres`);
          }
          sitesToMigrate = siteResults;
        }
        
        console.log(`📋 Found ${sitesToMigrate.length} site(s) to migrate`);
        
        if (sitesToMigrate.length === 0) {
          return Response.json({
            successful: 0,
            failed: 0,
            totalSites: 0,
            totalEvents: 0,
            migratedEvents: 0,
            message: 'No sites to migrate'
          });
        }
        
        // Migrate each site
        const results: MigrationResult[] = [];
        const config = { batchSize, dryRun, verify, recordLimit };
        
        for (const site of sitesToMigrate) {
          const result = await migrateSiteEvents(site.site_id, env, config);
          results.push(result);
        }
        
        // Summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const totalEvents = results.reduce((sum, r) => sum + r.totalEvents, 0);
        const migratedEvents = results.reduce((sum, r) => sum + r.migratedEvents, 0);
        
        console.log(`\n📊 Migration Summary:`);
        console.log(`   ✅ Successful sites: ${successful}`);
        console.log(`   ❌ Failed sites: ${failed}`);
        console.log(`   📋 Total sites: ${sitesToMigrate.length}`);
        console.log(`   📝 Total events: ${totalEvents}`);
        console.log(`   🚀 Migrated events: ${migratedEvents}`);
        
        if (failed > 0) {
          console.log(`\n⚠️  Failed migrations:`);
          results.filter(r => !r.success).forEach(result => {
            console.log(`   Site ${result.siteId}: ${result.errors.join(', ')}`);
          });
        } else {
          console.log(`\n🎉 All migrations completed successfully!`);
        }
        
        return Response.json({
          successful,
          failed,
          totalSites: sitesToMigrate.length,
          totalEvents,
          migratedEvents,
          results,
          message: failed > 0 ? `${failed} site migrations failed` : 'All migrations completed successfully'
        });
        
      } catch (error) {
        console.error('❌ Migration failed:', error);
        return Response.json(
          { 
            error: 'Migration failed', 
            message: error instanceof Error ? error.message : String(error) 
          },
          { status: 500 }
        );
      }
    }
    
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
};