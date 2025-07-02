// src/app/eventsApi.ts

import { env } from 'cloudflare:workers'; // Import env for KV access
import type { pageEvent } from '@/templates/lytxpixel'; // Added import

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
