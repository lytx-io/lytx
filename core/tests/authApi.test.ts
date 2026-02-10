import { afterEach, describe, expect, mock, test } from "bun:test";

const createRequest = (body: unknown) =>
  new Request("https://example.com/api/resend-verification-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

afterEach(() => {
  mock.restore();
});

mock.module("cloudflare:workers", () => ({
  env: {
    lytx_sessions: {
      get: async () => null,
      put: async () => undefined,
    },
  },
}));

mock.module("rwsdk/router", () => ({
  route: (_path: string, handler: any) => ({ handler }),
}));

mock.module("rwsdk/dist/runtime/entries/routerClient.js", () => ({
  route: (_path: string, handler: any) => ({ handler }),
}));

describe("resendVerificationEmailRoute", () => {
  test("rejects invalid json", async () => {
    const { resendVerificationEmailRoute } = await import("../src/api/auth_api");
    const handler = resendVerificationEmailRoute.handler as any;

    const request = new Request("https://example.com/api/resend-verification-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{" ,
    });

    const response = await handler({ request } as any);
    expect(response.status).toBe(400);
  });

  test("rejects missing email", async () => {
    const { resendVerificationEmailRoute } = await import("../src/api/auth_api");
    const handler = resendVerificationEmailRoute.handler as any;

    const response = await handler({ request: createRequest({}) } as any);
    expect(response.status).toBe(400);
  });

  test("rejects invalid callbackURL", async () => {
    const { resendVerificationEmailRoute } = await import("../src/api/auth_api");
    const handler = resendVerificationEmailRoute.handler as any;

    const response = await handler({
      request: createRequest({
        email: "test@example.com",
        callbackURL: "https://evil.com",
      }),
    } as any);

    expect(response.status).toBe(400);
  });

  test("returns 200 for rate limited requests", async () => {
    mock.module("cloudflare:workers", () => ({
      env: {
        lytx_sessions: {
          get: async () => "1",
          put: async () => undefined,
        },
      },
    }));

    const { resendVerificationEmailRoute } = await import("../src/api/auth_api");
    const handler = resendVerificationEmailRoute.handler as any;

    const response = await handler({
      request: createRequest({ email: "test@example.com" }),
    } as any);

    expect(response.status).toBe(200);
  });

  test("proxy response returns 200 on 400/403", async () => {
    mock.module("@lib/auth", () => ({
      auth: {
        handler: async () => new Response("bad", { status: 400 }),
      },
    }));

    const { resendVerificationEmailRoute } = await import("../src/api/auth_api");
    const handler = resendVerificationEmailRoute.handler as any;

    const response = await handler({
      request: createRequest({ email: "test@example.com" }),
    } as any);

    expect(response.status).toBe(200);
  });

  test("returns 200 on successful proxy", async () => {
    mock.module("@lib/auth", () => ({
      auth: {
        handler: async () => new Response("ok", { status: 200 }),
      },
    }));

    const { resendVerificationEmailRoute } = await import("../src/api/auth_api");
    const handler = resendVerificationEmailRoute.handler as any;

    const response = await handler({
      request: createRequest({ email: "test@example.com" }),
    } as any);

    expect(response.status).toBe(200);
  });
});
