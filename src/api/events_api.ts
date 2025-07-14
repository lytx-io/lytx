// src/app/eventsApi.ts

import { env } from 'cloudflare:workers'; // Import env for KV access
import type { pageEvent } from '@/templates/lytxpixel'; // Added import
import { route } from 'rwsdk/router';
import { RequestInfo } from 'rwsdk/worker';
import { AppContext } from '@/worker';

// Local pageEvent definition removed:
// export type pageEvent = {
//     event_name: string;
//     condition: "page_load" | "click" | "custom_event" | "scroll" | "form_submission" | "element_visibility";
//     QuantcastPixelId?: string;
//     QuantCastPixelLabel?: string;
//     SimplfiPixelid?: string;
//     googleanalytics?: string;
//     googleadsscript?: string;
//     googleadsconversion?: string;
//     metaEvent?: string;
//     linkedinEvent?: string;
//     clickCease?: string;
//     data_passback?: string;
//     parameters?: string;
//     paramConfig?: string;
//     query_parameters?: string;
//     customScript?: string;
//     rules?: string;
//     Notes?: string;
// };

const KV_NAMESPACE = env.LYTX_EVENTS;

export async function getEventsFromKV(tagId: string): Promise<pageEvent[] | null> {
  if (!tagId) {
    console.error('Tag ID is required to fetch events from KV.');
    return null;
  }
  if (!KV_NAMESPACE) {
    console.error('KV Namespace (LYTX_EVENTS) is not available.');
    return null;
  }

  try {
    const eventsJson = await KV_NAMESPACE.get(tagId, { type: 'json' });
    if (eventsJson === null) {
      return [];
    }
    if (!Array.isArray(eventsJson)) {
      console.error(`Data in KV for tagId '${tagId}' is not an array.`);
      return [];
    }
    return eventsJson as pageEvent[]; // Should now use the imported pageEvent
  } catch (error) {
    console.error(`Error fetching events for tagId '${tagId}' from KV:`, error);
    throw new Error(`Failed to fetch events from KV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function saveEventsToKV(tagId: string, eventsData: pageEvent[]): Promise<boolean> {
  if (!tagId) {
    console.error('Tag ID is required to save events to KV.');
    return false;
  }
  if (!KV_NAMESPACE) {
    console.error('KV Namespace (LYTX_EVENTS) is not available.');
    return false;
  }
  if (!Array.isArray(eventsData)) {
    console.error('Events data must be an array.');
    return false;
  }

  try {
    await KV_NAMESPACE.put(tagId, JSON.stringify(eventsData));
    return true;
  } catch (error) {
    console.error(`Error saving events for tagId '${tagId}' to KV:`, error);
    throw new Error(`Failed to save events to KV: ${error instanceof Error ? error.message : String(error)}`);
  }
}


/**
 * GET/POST /api/events/:tagId
 *
 * This is the events API endpoint
 */
export const eventsApi = route<RequestInfo<{ tagId: string | null }, AppContext>>("/api/events/:tagId", async ({ params, request }) => {
  if (!["GET", "POST"].includes(request.method)) {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const tagId = params.tagId;
  if (!tagId) {
    return new Response("Tag ID is required", { status: 400 });
  }

  //PERF: GET
  if (request.method === "GET") {
    try {
      const events = await getEventsFromKV(tagId);
      if (!events) {
        return new Response("Events not found or error fetching", { status: 404 });
      }
      return new Response(JSON.stringify(events), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error in GET /api/events/:tagId route:", error);
      return new Response(error instanceof Error ? error.message : "Failed to fetch events", { status: 500 });
    }
  }
  //PERF: POST
  if (request.method === "POST") { // Changed from !== to === (or ==, but === is stricter)
    try {
      //TODO: RENAME THESE TYPES
      const eventsData = await request.json() as PageEvent[];
      if (!Array.isArray(eventsData)) {
        return new Response("Invalid events data format: expected an array.", { status: 400 });
      }

      //FIX: TYPE ERROR    
      const success = await saveEventsToKV(tagId, eventsData);
      if (success) {
        return new Response(JSON.stringify({ message: "Events saved successfully" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } else {
        return new Response("Failed to save events", { status: 500 });
      }
    } catch (error) {
      console.error("Error in POST /api/events/:tagId route:", error);
      const message = error instanceof Error ? error.message : "Failed to save events";
      if (message.includes("Unexpected token") || message.includes("JSON at position")) {
        return new Response("Invalid JSON format in request body.", { status: 400 });
      }
      return new Response(message, { status: 500 });
    }
  }
  return new Response("Method Not Allowed", { status: 405 });
});
