import type { RequestInfo } from "rwsdk/worker";

import type { AppContext } from "@/types/app-context";
import { d1_client } from "@db/d1/client";
import { sites, team } from "@db/d1/schema";
import { asc, eq } from "drizzle-orm";

const DEMO_USER_ID = "lytx-demo-user";
const DEMO_USER_EMAIL = "demo@lytx.local";

export async function demoSessionMiddleware({ ctx }: RequestInfo<unknown, AppContext>) {
  const [primaryTeam] = await d1_client
    .select({
      id: team.id,
      name: team.name,
      external_id: team.external_id,
      db_adapter: team.db_adapter,
    })
    .from(team)
    .orderBy(asc(team.id))
    .limit(1);

  if (!primaryTeam) {
    return new Response("Demo mode requires at least one team in the database. Seed data first.", { status: 503 });
  }

  const teamSites = await d1_client
    .select()
    .from(sites)
    .where(eq(sites.team_id, primaryTeam.id));

  const normalizedSites = teamSites.map((site: (typeof teamSites)[number]) => ({
    ...site,
    event_load_strategy: site.event_load_strategy ?? "sdk",
    gdpr: site.gdpr ?? false,
  }));

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (1000 * 60 * 60 * 24 * 365 * 10));
  const normalizedTeamName = primaryTeam.name ?? "Demo Team";
  const normalizedExternalTeamId = primaryTeam.external_id ?? 0;

  ctx.initial_site_setup = normalizedSites.length > 0;
  ctx.db_adapter = primaryTeam.db_adapter;
  ctx.sites = normalizedSites;
  ctx.team = {
    id: primaryTeam.id,
    name: normalizedTeamName,
    external_id: normalizedExternalTeamId,
  };
  ctx.user_role = "admin";
  ctx.session = {
    session: {
      id: "lytx-demo-session",
      createdAt: now,
      updatedAt: now,
      userId: DEMO_USER_ID,
      expiresAt,
      token: "lytx-demo-token",
      ipAddress: null,
      userAgent: "lytx-demo-mode",
    },
    user: {
      id: DEMO_USER_ID,
      name: "Demo User",
      email: DEMO_USER_EMAIL,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    },
    initial_site_setup: normalizedSites.length > 0,
    email_verified: true,
    team: {
      id: primaryTeam.id,
      name: normalizedTeamName,
      external_id: normalizedExternalTeamId,
    },
    all_teams: [{
      id: primaryTeam.id,
      name: normalizedTeamName,
      external_id: normalizedExternalTeamId,
    }],
    role: "admin",
    db_adapter: primaryTeam.db_adapter,
    userSites: normalizedSites,
    timezone: "UTC",
    last_site_id: normalizedSites[0]?.site_id ?? null,
    last_team_id: primaryTeam.id,
  };
}
