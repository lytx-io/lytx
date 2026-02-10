#!/usr/bin/env bun
/**
 * Migration Worker Script
 * 
 * This script runs inside the Cloudflare Workers environment to perform
 * data migration from D1/Postgres to Durable Objects using the existing
 * infrastructure (writeToDurableObject, insertSiteEvents, etc.)
 * 
 * Usage:
 *   1. Deploy this as a temporary worker or run with wrangler dev
 *   2. Call the migration endpoints to trigger migration
 *   3. Remove after migration is complete
 */

import { writeToDurableObject } from '@/session/durableObjectClient';
import { drizzle } from 'drizzle-orm/d1';
import { siteEvents as d1SiteEvents } from '@db/d1/schema';
import { eq } from 'drizzle-orm';
import type { SiteEventInput } from '@/session/siteSchema';

interface MigrationRequest {
  siteId: number;
  batchSize?: number;
  dryRun?: boolean;
  verify?: boolean;
}

interface MigrationResponse {
  success: boolean;
  siteId: number;
  totalEvents: number;
  migratedEvents: number;
  batches: number;
  errors?: string[];
  dryRun?: boolean;
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
 * Migrate a single site's events from D1 to Durable Object
 */
async function migrateSiteEvents(
  siteId: number,
  env: Env,
  batchSize: number = 50,
  dryRun: boolean = false
): Promise<MigrationResponse> {
  const db = drizzle(env.lytx_core_db);
  const errors: string[] = [];
  
  try {
    // Get all events for this site from D1
    const events = await db
      .select()
      .from(d1SiteEvents)
      .where(eq(d1SiteEvents.site_id, siteId))
      .orderBy(d1SiteEvents.createdAt);

    console.log(`Found ${events.length} events for site ${siteId}`);

    if (events.length === 0) {
      return {
        success: true,
        siteId,
        totalEvents: 0,
        migratedEvents: 0,
        batches: 0,
        dryRun
      };
    }

    // Transform events for durable object
    const transformedEvents = transformEventsForDurableObject(events);

    if (dryRun) {
      return {
        success: true,
        siteId,
        totalEvents: events.length,
        migratedEvents: 0,
        batches: Math.ceil(events.length / batchSize),
        dryRun: true
      };
    }

    // Process in batches
    let migratedCount = 0;
    const totalBatches = Math.ceil(transformedEvents.length / batchSize);

    for (let i = 0; i < transformedEvents.length; i += batchSize) {
      const batch = transformedEvents.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} events) for site ${siteId}`);

      try {
        const result = await writeToDurableObject(siteId, batch, env);
        
        if (result.success) {
          migratedCount += result.inserted || batch.length;
        } else {
          errors.push(`Batch ${batchNumber}: ${result.error}`);
        }
      } catch (error) {
        const errorMsg = `Batch ${batchNumber} failed: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return {
      success: errors.length === 0,
      siteId,
      totalEvents: events.length,
      migratedEvents: migratedCount,
      batches: totalBatches,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    const errorMsg = `Migration failed for site ${siteId}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    
    return {
      success: false,
      siteId,
      totalEvents: 0,
      migratedEvents: 0,
      batches: 0,
      errors: [errorMsg]
    };
  }
}

/**
 * Verify migration by checking durable object has events
 */
async function verifyMigration(siteId: number, expectedCount: number, env: Env): Promise<{ success: boolean; actualCount: number; expectedCount: number }> {
  try {
    // Get the durable object for this site
    const durableObjectId = env.SITE_DURABLE_OBJECT.idFromName(`Site-${siteId}`);
    const durableObject = env.SITE_DURABLE_OBJECT.get(durableObjectId);
    
    // Get health check which includes total events
    const response = await durableObject.fetch('https://durable-object/health');
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    const health = await response.json() as { totalEvents: number };
    
    return {
      success: health.totalEvents === expectedCount,
      actualCount: health.totalEvents,
      expectedCount
    };
  } catch (error) {
    console.error(`Verification failed for site ${siteId}:`, error);
    return {
      success: false,
      actualCount: -1,
      expectedCount
    };
  }
}

/**
 * Worker fetch handler for migration endpoints
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers for development
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // POST /migrate-site - Migrate a single site
      if (url.pathname === '/migrate-site' && request.method === 'POST') {
        const body = await request.json() as MigrationRequest;
        const { siteId, batchSize = 50, dryRun = false, verify = false } = body;

        if (!siteId) {
          return new Response(JSON.stringify({ error: 'siteId is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Perform migration
        const migrationResult = await migrateSiteEvents(siteId, env, batchSize, dryRun);

        // Perform verification if requested and migration was successful
        let verificationResult;
        if (verify && migrationResult.success && !dryRun) {
          verificationResult = await verifyMigration(siteId, migrationResult.totalEvents, env);
        }

        return new Response(JSON.stringify({
          migration: migrationResult,
          verification: verificationResult
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // GET /health - Health check
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'migration-worker',
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // GET /verify-site/:siteId - Verify a site's migration
      const verifyMatch = url.pathname.match(/^\/verify-site\/(\d+)$/);
      if (verifyMatch && request.method === 'GET') {
        const siteId = parseInt(verifyMatch[1]);
        const expectedCount = parseInt(url.searchParams.get('expectedCount') || '0');
        
        const verificationResult = await verifyMigration(siteId, expectedCount, env);
        
        return new Response(JSON.stringify(verificationResult), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      console.error('Migration worker error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};