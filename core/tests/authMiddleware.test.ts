import { afterEach, describe, expect, mock, test } from "bun:test";

const defaultHeaders = new Headers({ "content-type": "application/json" });

afterEach(() => {
  mock.restore();
});

describe("authMiddleware", () => {
  test("allows GET/POST through auth handler", async () => {
    const handler = mock(async () => new Response("ok"));

    mock.module("../lib/auth", () => ({
      auth: {
        handler,
        api: {
          getSession: mock(async () => null),
        },
      },
    }));

    const { authMiddleware } = await import("../src/api/authMiddleware");

    const response = await authMiddleware({
      request: new Request("https://example.com", {
        method: "GET",
        headers: defaultHeaders,
      }),
    } as any);

    expect(response?.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  test("rejects non-GET/POST methods", async () => {
    const { authMiddleware } = await import("../src/api/authMiddleware");

    const response = await authMiddleware({
      request: new Request("https://example.com", {
        method: "PUT",
        headers: defaultHeaders,
      }),
    } as any);

    expect(response?.status).toBe(405);
  });
});

describe("sessionMiddleware", () => {
  test("redirects when session missing", async () => {
    mock.module("../lib/auth", () => ({
      auth: {
        handler: mock(async () => new Response("ok")),
        api: {
          getSession: mock(async () => null),
        },
      },
    }));

    const { sessionMiddleware } = await import("../src/api/authMiddleware");

    const response = await sessionMiddleware({
      request: new Request("https://example.com", { method: "GET" }),
      ctx: {} as any,
    } as any);

    expect(response?.status).toBe(303);
    expect(response?.headers.get("location")).toBe("/login");
  });

  test("hydrates ctx when session exists", async () => {
    const session = {
      initial_site_setup: true,
      db_adapter: "sqlite",
      userSites: [{ site_id: 5 }],
      team: { id: 2 },
      role: "admin",
    };

    mock.module("../lib/auth", () => ({
      auth: {
        handler: mock(async () => new Response("ok")),
        api: {
          getSession: mock(async () => session),
        },
      },
    }));

    const { sessionMiddleware } = await import("../src/api/authMiddleware");
    const ctx: any = {};

    const response = await sessionMiddleware({
      request: new Request("https://example.com", { method: "GET" }),
      ctx,
    } as any);

    expect(response).toBeUndefined();
    expect(ctx.db_adapter).toBe("sqlite");
    expect(ctx.initial_site_setup).toBe(true);
    expect(ctx.sites).toEqual([{ site_id: 5 }]);
  });
});

describe("getSiteFromContext", () => {
  test("returns site when found", async () => {
    const { getSiteFromContext } = await import("../src/api/authMiddleware");
    const ctx = {
      session: { id: "session-1" },
      sites: [{ site_id: 5, uuid: "site-5" }],
    } as any;

    expect(getSiteFromContext(ctx, 5)).toEqual({ site_id: 5, uuid: "site-5" } as any);
  });

  test("returns null without session", async () => {
    const { getSiteFromContext } = await import("../src/api/authMiddleware");
    const ctx = { session: null, sites: [{ site_id: 5 }] } as any;

    expect(getSiteFromContext(ctx, 5)).toBeNull();
  });
});
