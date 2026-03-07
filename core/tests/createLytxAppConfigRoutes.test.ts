import { describe, expect, test } from "bun:test";
import { parseCreateLytxAppConfig } from "../src/config/createLytxAppConfig";

describe("createLytxApp routes config", () => {
  test("accepts route override functions", () => {
    const parsed = parseCreateLytxAppConfig({
      cache: {
        persistHistoricalAnalyticsToEventsKv: true,
      },
      routes: {
        document: ({ children }) => children,
        additionalRoutes: [
          { type: "custom-route" } as any,
        ],
        ui: {
          dashboard: () => new Response("dashboard"),
          events: () => new Response("events"),
          explore: () => new Response("explore"),
        },
      },
    });

    expect(typeof parsed.routes?.document).toBe("function");
    expect(parsed.cache?.persistHistoricalAnalyticsToEventsKv).toBe(true);
    expect(parsed.routes?.additionalRoutes?.length).toBe(1);
    expect(typeof parsed.routes?.ui?.dashboard).toBe("function");
    expect(typeof parsed.routes?.ui?.events).toBe("function");
    expect(typeof parsed.routes?.ui?.explore).toBe("function");
  });

  test("rejects non-function route overrides", () => {
    expect(() =>
      parseCreateLytxAppConfig({
        routes: {
          ui: {
            // @ts-expect-error runtime validation path
            dashboard: "not-a-function",
          },
        },
      })
    ).toThrow("routes.ui.dashboard");
  });

  test("rejects non-array additional routes", () => {
    expect(() =>
      parseCreateLytxAppConfig({
        routes: {
          // @ts-expect-error runtime validation path
          additionalRoutes: "not-an-array",
        },
      })
    ).toThrow("routes.additionalRoutes");
  });

  test("rejects non-function document override", () => {
    expect(() =>
      parseCreateLytxAppConfig({
        routes: {
          // @ts-expect-error runtime validation path
          document: "not-a-component",
        },
      })
    ).toThrow("routes.document");
  });

  test("rejects non-boolean cache persistence override", () => {
    expect(() =>
      parseCreateLytxAppConfig({
        cache: {
          // @ts-expect-error runtime validation path
          persistHistoricalAnalyticsToEventsKv: "yes",
        },
      })
    ).toThrow("cache.persistHistoricalAnalyticsToEventsKv");
  });
});
