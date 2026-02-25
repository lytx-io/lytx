import { afterEach, describe, expect, mock, test } from "bun:test";

function setupSeedApiMocks(signupMode: "demo" | "bootstrap_then_invite") {
  const teamTable = {
    id: "team.id",
    name: "team.name",
    db_adapter: "team.db_adapter",
  };

  mock.module("rwsdk/router", () => ({
    route: (path: string, handler: any) => ({ path, handler }),
  }));

  mock.module("cloudflare:workers", () => ({
    env: {
      SEED_DATA_SECRET: "demo-seed-secret",
      ENVIRONMENT: "production",
    },
  }));

  mock.module("rwsdk/constants", () => ({
    IS_DEV: false,
  }));

  mock.module("@lib/auth", () => ({
    getSignupMode: () => signupMode,
  }));

  mock.module("@db/d1/schema", () => ({
    team: teamTable,
    sites: {},
  }));

  mock.module("drizzle-orm", () => ({
    eq: () => ({}),
    and: () => ({}),
  }));

  mock.module("@db/adapter", () => ({
    insertSiteEvents: async () => ({ success: true, inserted: 1 }),
  }));

  mock.module("@db/d1/client", () => ({
    d1_client: {
      select: () => ({
        from: (table: unknown) => {
          if (table === teamTable) {
            return {
              where: () => ({
                limit: async () => [{ id: 1, name: "Demo Team", db_adapter: "sqlite" }],
              }),
            };
          }

          return {
            where: () => ({
              limit: async () => [],
            }),
          };
        },
      }),
    },
  }));
}

afterEach(() => {
  mock.restore();
});

describe("seedApi guard behavior", () => {
  test("allows seed endpoint in production when signup mode is demo", async () => {
    setupSeedApiMocks("demo");
    const { seedApi } = await import(`../src/api/seed_api?demo=${Date.now()}`);

    const response = await seedApi.handler({
      params: { $0: "team/1" },
      request: new Request("https://example.com/api/seed/team/1", {
        method: "GET",
        headers: { "x-seed-secret": "demo-seed-secret" },
      }),
    } as any);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 1, name: "Demo Team", db_adapter: "sqlite" });
  });

  test("keeps seed endpoint blocked in production for non-demo signup mode", async () => {
    setupSeedApiMocks("bootstrap_then_invite");
    const { seedApi } = await import(`../src/api/seed_api?bootstrap=${Date.now()}`);

    const response = await seedApi.handler({
      params: { $0: "team/1" },
      request: new Request("https://example.com/api/seed/team/1", {
        method: "GET",
        headers: { "x-seed-secret": "demo-seed-secret" },
      }),
    } as any);

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("disabled outside dev");
  });
});
