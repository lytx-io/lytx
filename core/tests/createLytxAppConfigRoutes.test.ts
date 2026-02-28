import { describe, expect, test } from "bun:test";
import { route } from "rwsdk/router";
import { parseCreateLytxAppConfig } from "../src/config/createLytxAppConfig";

describe("createLytxApp routes.ui config", () => {
  test("accepts route override functions", () => {
    const parsed = parseCreateLytxAppConfig({
      routes: {
        additionalRoutes: [
          route("/dashboard/custom", () => new Response("custom")),
        ],
        ui: {
          dashboard: () => new Response("dashboard"),
          events: () => new Response("events"),
          explore: () => new Response("explore"),
        },
      },
    });

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
});
