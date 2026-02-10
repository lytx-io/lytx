import { afterEach, describe, expect, mock, test } from "bun:test";

const shouldRun = false;
const testFn = shouldRun ? test : test.skip;

afterEach(() => {
  mock.restore();
});

mock.module("rwsdk/router", () => ({
  route: (_path: string, handlers: any) => {
    const handler = Array.isArray(handlers) ? handlers[1] : handlers;
    return { handler };
  },
}));

mock.module("rwsdk/dist/runtime/entries/routerClient.js", () => ({
  route: (_path: string, handlers: any) => {
    const handler = Array.isArray(handlers) ? handlers[1] : handlers;
    return { handler };
  },
}));

mock.module("@/utilities/route_interuptors", () => ({
  checkIfTeamSetupSites: () => undefined,
}));

mock.module("@/api/authMiddleware", () => ({
  getSiteFromContext: (_ctx: any, siteId: number) =>
    siteId === 5 ? { uuid: "site-uuid" } : null,
}));

mock.module("@db/durable/durableObjectClient", () => ({
  getDurableDatabaseStub: async () => ({
    getCurrentVisitors: async () => ({ total: 2 }),
  }),
}));

mock.module("/home/rtg/development/lytx-projects/core/db/durable/durableObjectClient.ts", () => ({
  getDurableDatabaseStub: async () => ({
    getCurrentVisitors: async () => ({ total: 2 }),
  }),
}));

describe("getCurrentVisitorsRoute", () => {
  testFn("requires site_id", async () => {
    const { getCurrentVisitorsRoute } = await import("../src/api/sites_api");
    const handler = getCurrentVisitorsRoute.handler as any;

    const response = await handler({
      request: new Request("https://example.com/dashboard/current-visitors", {
        method: "GET",
      }),
      ctx: {} as any,
    } as any);

    expect(response.status).toBe(400);
  });

  testFn("returns 404 for missing site", async () => {
    const { getCurrentVisitorsRoute } = await import("../src/api/sites_api");
    const handler = getCurrentVisitorsRoute.handler as any;

    const response = await handler({
      request: new Request(
        "https://example.com/dashboard/current-visitors?site_id=123",
        { method: "GET" },
      ),
      ctx: {} as any,
    } as any);

    expect(response.status).toBe(404);
  });

  testFn("returns current visitors", async () => {
    const { getCurrentVisitorsRoute } = await import("../src/api/sites_api");
    const handler = getCurrentVisitorsRoute.handler as any;

    const response = await handler({
      request: new Request(
        "https://example.com/dashboard/current-visitors?site_id=5",
        { method: "GET" },
      ),
      ctx: {} as any,
    } as any);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { total?: number };
    expect(body.total).toBe(2);
  });
});
