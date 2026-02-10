
import { afterEach, describe, expect, mock, test } from "bun:test";

const baseHeaders = {
  "content-type": "application/json",
  "x-seed-secret": "test-secret",
};

afterEach(() => {
  mock.restore();
});

mock.module("@db/d1/client", () => ({
  d1_client: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              uuid: "site-uuid",
              site_db_adapter: "sqlite",
            },
          ],
        }),
      }),
    }),
  },
}));

mock.module("@db/durable/durableObjectClient", () => ({
  getDashboardDataFromDurableObject: async () => ({
    query: {
      events: [{ tag_id: "tag-1", event: "page_view" }],
    },
  }),
}));

mock.module("rwsdk/router", () => ({
  route: (path: string, handler: any) => ({ path, handler }),
}));

mock.module("rwsdk/dist/runtime/entries/routerClient.js", () => ({
  route: (path: string, handler: any) => ({ path, handler }),
}));

mock.module("@db/adapter", () => ({
  insertSiteEvents: async () => ({ success: true, inserted: 1 }),
}));

mock.module("cloudflare:workers", () => ({
  env: { SEED_DATA_SECRET: "test-secret" },
}));

mock.module("rwsdk/constants", () => ({
  IS_DEV: true,
}));

describe("eventsApi", () => {
  test("rejects when seed secret missing", async () => {
    const { eventsApi } = await import("../src/api/events_api");
    const handler = eventsApi.handler as any;

    const response = await handler({
      params: { $0: "5" },
      request: new Request("https://example.com/api/events/5", {
        method: "GET",
      }),
    } as any);

    expect(response.status).toBe(401);
  });

  test("handles GET with seed secret", async () => {
    const { eventsApi } = await import("../src/api/events_api");
    const handler = eventsApi.handler as any;

    const response = await handler({
      params: { $0: "5" },
      request: new Request("https://example.com/api/events/5", {
        method: "GET",
        headers: baseHeaders,
      }),
    } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });

  test("handles POST with seed secret", async () => {
    const { eventsApi } = await import("../src/api/events_api");
    const handler = eventsApi.handler as any;

    const response = await handler({
      params: { $0: "5" },
      request: new Request("https://example.com/api/events/5", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify([
          {
            event: "page_view",
            tag_id: "tag-1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]),
      }),
    } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });
});
