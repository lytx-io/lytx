import { afterEach, describe, expect, mock, test } from "bun:test";

type DemoMiddlewareMockOptions = {
  teamRows: Array<Record<string, unknown>>;
  siteRows: Array<Record<string, unknown>>;
};

function setupDemoMiddlewareMocks(options: DemoMiddlewareMockOptions) {
  const teamTable = {
    id: "team.id",
    name: "team.name",
    external_id: "team.external_id",
    db_adapter: "team.db_adapter",
  };
  const sitesTable = {
    team_id: "sites.team_id",
  };

  mock.module("@db/d1/schema", () => ({
    user: {
      id: "user.id",
      timezone: "user.timezone",
    },
    team: teamTable,
    sites: sitesTable,
  }));

  mock.module("drizzle-orm", () => ({
    asc: (value: unknown) => ({ type: "asc", value }),
    eq: (left: unknown, right: unknown) => ({ type: "eq", left, right }),
  }));

  mock.module("@db/d1/client", () => ({
    d1_client: {
      select: () => ({
        from: (table: unknown) => {
          if (table === teamTable) {
            return {
              orderBy: () => ({
                limit: async () => options.teamRows,
              }),
            };
          }

          if (table === sitesTable) {
            return {
              where: async () => options.siteRows,
            };
          }

          throw new Error("Unexpected table in demo middleware test");
        },
      }),
    },
  }));
}

afterEach(() => {
  mock.restore();
});

describe("demoSessionMiddleware", () => {
  test("hydrates context with synthetic demo session", async () => {
    setupDemoMiddlewareMocks({
      teamRows: [{ id: 42, name: null, external_id: null, db_adapter: "sqlite" }],
      siteRows: [
        {
          site_id: 7,
          tag_id: "site-tag-7",
          team_id: 42,
          name: "Main Site",
          event_load_strategy: null,
          gdpr: null,
        },
      ],
    });

    const { demoSessionMiddleware } = await import("../src/api/demo_middleware");
    const ctx: any = {};

    const response = await demoSessionMiddleware({ ctx } as any);

    expect(response).toBeUndefined();
    expect(ctx.user_role).toBe("admin");
    expect(ctx.team).toEqual({ id: 42, name: "Demo Team", external_id: 0 });
    expect(ctx.initial_site_setup).toBe(true);
    expect(ctx.sites).toHaveLength(1);
    expect(ctx.sites[0].event_load_strategy).toBe("sdk");
    expect(ctx.sites[0].gdpr).toBe(false);
    expect(ctx.session.user.id).toBe("lytx-demo-user");
    expect(ctx.session.user.email).toBe("demo@lytx.local");
    expect(ctx.session.role).toBe("admin");
    expect(ctx.session.last_site_id).toBe(7);
    expect(ctx.session.last_team_id).toBe(42);
  });

  test("returns 503 when no team exists", async () => {
    setupDemoMiddlewareMocks({
      teamRows: [],
      siteRows: [],
    });

    const { demoSessionMiddleware } = await import("../src/api/demo_middleware");

    const response = await demoSessionMiddleware({ ctx: {} as any } as any);

    expect(response?.status).toBe(503);
    expect(await response?.text()).toContain("Demo mode requires at least one team");
  });
});
