import { SiteDurableObject as SiteDurableObjectImpl } from "../db/durable/siteDurableObject";

// Re-declare the class in this module so workerd/miniflare can resolve it
// as a concrete durable object export on this worker script.
export class SiteDurableObject extends SiteDurableObjectImpl {}

export default {
  async fetch(): Promise<Response> {
    return new Response("site durable object host");
  },
} satisfies ExportedHandler;
