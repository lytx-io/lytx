import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { d1_client } from "@db/d1/client"
import { env } from "cloudflare:workers";
import * as schema from "@db/d1/schema";
import type { DBAdapter } from "@db/d1/schema";
import { createNewAccount, getSitesForUser } from "@db/d1/sites";
import { customSession } from "better-auth/plugins";
import { sendVerificationEmail } from "@lib/sendMail";
import { IS_DEV } from "rwsdk/constants";
// import { drizzle } from 'drizzle-orm/better-sqlite3';
// import * as dotenv from 'dotenv';
// dotenv.config();
// const dev_db = drizzle(process.env.LOCAL_D1!);

export type AuthUserSession = typeof auth.$Infer.Session;
export const auth = betterAuth({
  trustedOrigins: IS_DEV
    ? [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:6124",
      "http://localhost:6123",
      "http://*.ts.net:*",
      "https://*.ts.net:*",
      env.BETTER_AUTH_URL,
    ]
    : [env.BETTER_AUTH_URL],

  plugins: [
    customSession(async ({ user, session }) => {
      let initial_site_setup = false;
      // //CONSIDER: Not using this?
      const lastTeamId = (user as any).last_team_id as number | null;
      const userSites = await getSitesForUser(user.id, lastTeamId);
      //
      let currentTeamId = 0;
      let currentTeamName = "";
      let db_adapter: DBAdapter = "sqlite";
      let teamExternalId = 0;
      let userRole = "viewer";
      if (userSites) {
        if (userSites.teamHasSites) {
          initial_site_setup = true;
        }
        //TODO: Handle this better
        currentTeamId = userSites.team.id;

        if (userSites.team.name) currentTeamName = userSites.team.name;
        if (userSites.team.db_adapter) db_adapter = userSites.team.db_adapter;
        if (userSites.team.external_id) teamExternalId = userSites.team.external_id;
        if (userSites.team.role) userRole = userSites.team.role;
      }

      const teams = [
        { id: currentTeamId, name: currentTeamName, external_id: teamExternalId },
      ];
      if (userSites) {
        if (userSites.all_teams) {
          const mappedTeams = userSites.all_teams.map((team) => ({ id: team.team_id, name: team.name!, external_id: team.external_id! }));
          teams.push(...mappedTeams);
        }
      }
      return {
        initial_site_setup: initial_site_setup,
        email_verified: user.emailVerified,
        team: { id: currentTeamId, name: currentTeamName, external_id: teamExternalId },
        all_teams: teams,
        role: userRole,
        db_adapter,
        userSites: userSites?.sitesList,
        timezone: (user as any).timezone as string | null,
        last_site_id: (user as any).last_site_id as number | null,
        last_team_id: currentTeamId || lastTeamId,
        user,
        session,
      };
    }),
  ],
  database: drizzleAdapter(d1_client, { provider: "sqlite", schema }),
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  rateLimit: {
    storage: "secondary-storage"
  },
  secondaryStorage: {
    get: async (key) => {
      const value = await env.lytx_sessions.get(key);
      return value ? value : null;
    },
    set: async (key, value, ttl) => {
      if (ttl) await env.lytx_sessions.put(key, value, { expirationTtl: ttl });
      else await env.lytx_sessions.put(key, value);
    },
    delete: async (key) => {
      await env.lytx_sessions.delete(key);
    },
  },
  onAPIError: {
    onError(error) {
      if (error instanceof Error) {
        console.error("Better Auth API error:", {
          name: error.name,
          message: error.message,
          stack: IS_DEV ? error.stack : undefined,
        });
        return;
      }

      console.error("Better Auth API error:", error);
    },
  },
  user: {

  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }, _request) => {
      if (IS_DEV) console.log('🔥🔥🔥 sendVerificationEmail', user, url);
      await sendVerificationEmail(user.email, url);

    }
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await createNewAccount(user);
        },
      }
    }
  },
  socialProviders: {
    // github: {
    //   clientId: env.GITHUB_CLIENT_ID,
    //   clientSecret: env.GITHUB_CLIENT_SECRET,
    // },
    // google: {
    //   clientId: env.GOOGLE_CLIENT_ID,
    //   clientSecret: env.GOOGLE_CLIENT_SECRET,
    // },
  }
});
