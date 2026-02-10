import type { SiteEventInput } from "@/session/siteSchema";
import type { DBAdapter } from "@db/types";
import { writeToDurableObject } from "@db/durable/durableObjectClient";
import { d1_client } from "@db/d1/client";
import { sites } from "@db/d1/schema";
import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { IS_DEV } from "rwsdk/constants";

/**
 * Queue message structure for site events
 */
export type QueueSiteEventInput = Omit<SiteEventInput, "createdAt" | "updatedAt"> & {
  createdAt?: string;
  updatedAt?: string;
};

export interface QueueMessage {
  type: "site_event";
  siteId: number;
  siteUuid?: string;
  teamId?: number;
  adapter: DBAdapter;
  events: QueueSiteEventInput[];
  timestamp: number;
}

type QueueMessageHandle = {
  body: QueueMessage;
  ack: () => void;
  retry: (options?: { delaySeconds?: number }) => void;
};

type QueueBatch = {
  messages: QueueMessageHandle[];
};

const MAX_DO_WRITE_EVENTS_PER_CALL = 200;

function chunkEvents<T>(events: T[], chunkSize: number): T[][] {
  if (events.length <= chunkSize) return [events];
  const chunks: T[][] = [];
  for (let i = 0; i < events.length; i += chunkSize) {
    chunks.push(events.slice(i, i + chunkSize));
  }
  return chunks;
}

function normalizeAdapter(adapter: string): DBAdapter {
  if (
    adapter === "postgres"
    || adapter === "singlestore"
    || adapter === "sqlite"
    || adapter === "analytics_engine"
  ) {
    return adapter;
  }
  return "sqlite";
}

function toQueueEvent(event: SiteEventInput): QueueSiteEventInput {
  return {
    ...event,
    createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : undefined,
    updatedAt: event.updatedAt instanceof Date ? event.updatedAt.toISOString() : undefined,
  };
}

function toSiteEventInput(event: QueueSiteEventInput): SiteEventInput {
  const createdAt = event.createdAt ? new Date(event.createdAt) : undefined;
  const updatedAt = event.updatedAt ? new Date(event.updatedAt) : undefined;

  return {
    ...event,
    createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : undefined,
    updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : undefined,
  };
}

async function getSiteUuid(siteId: number): Promise<string | null> {
  const [site] = await d1_client
    .select({ uuid: sites.uuid })
    .from(sites)
    .where(eq(sites.site_id, siteId))
    .limit(1);

  return site?.uuid ?? null;
}

/**
 * Queue worker handler for processing site events
 * 
 * This function processes batches of site events and writes them to
 * the site-specific durable object used by dashboard queries.
 */
export async function handleQueueMessage(
  batch: QueueBatch,
): Promise<void> {
  if (IS_DEV) console.log(`Processing queue batch with ${batch.messages.length} messages`);

  const messagesBySite = new Map<number, {
    siteUuid?: string;
    adapter: DBAdapter;
    events: SiteEventInput[];
    messages: QueueMessageHandle[];
  }>();

  for (const message of batch.messages) {
    const { siteId, siteUuid, adapter, events } = message.body;

    const existing = messagesBySite.get(siteId);
    const normalizedEvents = events.map(toSiteEventInput);

    if (existing) {
      existing.events.push(...normalizedEvents);
      existing.messages.push(message);
      if (!existing.siteUuid && siteUuid) {
        existing.siteUuid = siteUuid;
      }
    } else {
      messagesBySite.set(siteId, {
        siteUuid,
        adapter,
        events: normalizedEvents,
        messages: [message],
      });
    }
  }

  for (const [siteId, siteBatch] of messagesBySite.entries()) {
    const { adapter, events, messages } = siteBatch;

    try {
      if (IS_DEV) console.log(`Processing site ${siteId} with ${events.length} events (adapter: ${adapter})`);

      const resolvedSiteUuid = siteBatch.siteUuid ?? await getSiteUuid(siteId);
      if (!resolvedSiteUuid) {
        throw new Error(`Unable to resolve site UUID for site ${siteId}`);
      }

      let insertedTotal = 0;
      const eventChunks = chunkEvents(events, MAX_DO_WRITE_EVENTS_PER_CALL);

      for (const eventChunk of eventChunks) {
        // Always write to durable object for fast dashboard access
        const durableResult = await writeToDurableObject(siteId, resolvedSiteUuid, eventChunk);

        if (!durableResult.success) {
          throw new Error(`Durable object write failed: ${durableResult.error}`);
        }

        insertedTotal += durableResult.inserted ?? eventChunk.length;
      }

      if (IS_DEV) {
        console.log(`✅ Wrote ${insertedTotal} events to durable object for site ${siteId} across ${eventChunks.length} chunk(s)`);
      }

      for (const message of messages) {
        message.ack();
      }

    } catch (error) {
      console.error(`❌ Queue processing failed for site ${siteId}:`, error);

      // Consumer-level retry policy is configured in Alchemy eventSources settings
      for (const message of messages) {
        message.retry({ delaySeconds: 5 });
      }
    }
  }
}

export async function batchProcessSiteEvents(
  eventsBySite: Map<number, { siteUuid?: string; teamId?: number; adapter: string; events: SiteEventInput[] }>,
): Promise<void> {
  const messages: QueueMessage[] = [];

  // Create queue messages for each site
  for (const [siteId, { siteUuid, teamId, adapter, events }] of eventsBySite) {
    messages.push({
      type: "site_event",
      siteId,
      siteUuid,
      teamId,
      adapter: normalizeAdapter(adapter),
      events: events.map(toQueueEvent),
      timestamp: Date.now(),
    });
  }

  // Send all messages to queue in batch
  if (messages.length > 0) {
    await env.SITE_EVENTS_QUEUE.sendBatch(
      messages.map(msg => ({ body: msg }))
    );

    if (IS_DEV) console.log(`📤 Sent ${messages.length} messages to queue for processing`);
  }
}

/**
 * Direct processing for sqlite sites (bypass queue)
 */
export async function processDirectSiteEvents(
  site_id: number,
  site_uuid: string,
  events: SiteEventInput[],
): Promise<{ success: boolean; inserted?: number; error?: string }> {
  try {
    // For sqlite sites, write directly to durable object
    const result = await writeToDurableObject(site_id, site_uuid, events);

    if (result.success) {
      if (IS_DEV) console.log(`✅ Direct write: ${result.inserted} events to durable object for site ${site_uuid}`);
    }

    return result;
  } catch (error) {
    console.error(`❌ Direct processing failed for site ${site_uuid}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function enqueueSiteEventsForProcessing(
  input: {
    siteId: number;
    siteUuid: string;
    teamId?: number;
    adapter: DBAdapter;
    events: SiteEventInput[];
  },
): Promise<void> {
  if (input.events.length === 0) return;

  const message: QueueMessage = {
    type: "site_event",
    siteId: input.siteId,
    siteUuid: input.siteUuid,
    teamId: input.teamId,
    adapter: input.adapter,
    events: input.events.map(toQueueEvent),
    timestamp: Date.now(),
  };
  if (IS_DEV) console.log("🔥🔥🔥 Sending site event for processing");
  await env.SITE_EVENTS_QUEUE.send(message);
}

/**
 * Health check for queue system
 */
export async function checkQueueHealth(env: Env): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: {
    queueAvailable: boolean;
    recentFailures: number;
    lastProcessedAt?: string;
  };
}> {
  try {
    // Check if queue is available by attempting to send a test message
    const testMessage: QueueMessage = {
      type: 'site_event',
      siteId: -1, // Test site ID
      teamId: -1,
      adapter: 'sqlite',
      events: [],
      timestamp: Date.now(),
    };

    // This will throw if queue is not available
    await env.SITE_EVENTS_QUEUE.send(testMessage);

    // Check recent failures from KV
    const failureKeys = await env.lytx_config.list({ prefix: 'failed_queue_message:' });
    const recentFailures = failureKeys.keys.filter(key => {
      const timestamp = parseInt(key.name.split(':').pop() || '0');
      return Date.now() - timestamp < 3600000; // Last hour
    }).length;

    return {
      status: recentFailures > 10 ? 'degraded' : 'healthy',
      details: {
        queueAvailable: true,
        recentFailures,
        lastProcessedAt: new Date().toISOString(),
      }
    };

  } catch (error) {
    console.error('Queue health check failed:', error);
    return {
      status: 'unhealthy',
      details: {
        queueAvailable: false,
        recentFailures: -1,
      }
    };
  }
}
