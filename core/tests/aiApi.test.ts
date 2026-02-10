import { afterEach, describe, expect, mock, test } from "bun:test";

const shouldRun = false;
const testFn = shouldRun ? test : test.skip;

afterEach(() => {
  mock.restore();
});

mock.module("rwsdk/router", () => ({
  route: (_path: string, handler: any) => ({ handler }),
}));

mock.module("rwsdk/dist/runtime/entries/routerClient.js", () => ({
  route: (_path: string, handler: any) => ({ handler }),
}));

mock.module("rwsdk/constants", () => ({
  IS_DEV: true,
}));

mock.module("@/utilities/encrypt", () => ({
  encrypt: async () => ({ encryptedValue: "encrypted", iv: "iv" }),
  decrypt: async () => "decrypted",
}));

mock.module("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: () => ({
    chatModel: () => ({}),
  }),
}));

mock.module("ai", () => ({
  generateText: async () => ({ text: "suggestion" }),
  streamText: () => ({
    toDataStreamResponse: () => new Response("stream"),
  }),
}));

mock.module("@db/durable/durableObjectClient", () => ({
  getDurableDatabaseStub: async () => ({
    healthCheck: async () => ({ totalEvents: 0 }),
  }),
}));

mock.module("/home/rtg/development/lytx-projects/core/db/durable/durableObjectClient.ts", () => ({
  getDurableDatabaseStub: async () => ({
    healthCheck: async () => ({ totalEvents: 0 }),
  }),
}));

mock.module("cloudflare:workers", () => ({
  env: {
    ENCRYPTION_KEY: "secret",
    lytx_config: {
      get: async () => null,
      put: async () => undefined,
    },
  },
}));

const createCtx = () =>
  ({
    team: { id: 1, external_id: 0 },
    user_role: "admin",
    sites: [{ site_id: 5, uuid: "site-uuid", domain: "example.com", tag_id: "tag-1" }],
  }) as any;

describe("aiConfigRoute", () => {
  testFn("rejects non-admin", async () => {
    const { aiConfigRoute } = await import("../src/api/ai_api");
    const handler = aiConfigRoute.handler as any;

    const ctx = createCtx();
    ctx.user_role = "viewer";

    const response = await handler({
      request: new Request("https://example.com/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseURL: "https://ai.example", model: "gpt" }),
      }),
      ctx,
    } as any);

    expect(response.status).toBe(403);
  });

  testFn("rejects invalid JSON", async () => {
    const { aiConfigRoute } = await import("../src/api/ai_api");
    const handler = aiConfigRoute.handler as any;

    const response = await handler({
      request: new Request("https://example.com/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
      ctx: createCtx(),
    } as any);

    expect(response.status).toBe(400);
  });
});

describe("aiTagSuggestRoute", () => {
  testFn("rejects invalid url", async () => {
    const { aiTagSuggestRoute } = await import("../src/api/ai_api");
    const handler = aiTagSuggestRoute.handler as any;

    const response = await handler({
      request: new Request("https://example.com/ai/site-tag-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "bad", site_id: 5 }),
      }),
      ctx: createCtx(),
    } as any);

    expect(response.status).toBe(400);
  });

  testFn("rejects missing site", async () => {
    const { aiTagSuggestRoute } = await import("../src/api/ai_api");
    const handler = aiTagSuggestRoute.handler as any;

    const ctx = createCtx();
    ctx.sites = [];

    const response = await handler({
      request: new Request("https://example.com/ai/site-tag-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", site_id: 5 }),
      }),
      ctx,
    } as any);

    expect(response.status).toBe(404);
  });
});

describe("aiChatRoute", () => {
  testFn("requires configured AI", async () => {
    const { aiChatRoute } = await import("../src/api/ai_api");
    const handler = aiChatRoute.handler as any;

    const response = await handler({
      request: new Request("https://example.com/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      }),
      ctx: createCtx(),
    } as any);

    expect(response.status).toBe(400);
  });
});
