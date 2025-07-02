import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { d1_client } from "@db/d1/client"
import { env } from "cloudflare:workers";
import * as schema from "@db/d1/schema";
import type { DBAdapter } from "@db/d1/schema";
import { createNewAccount, getSitesForUser } from "@db/d1/sites";
import { customSession } from "better-auth/plugins";
import { sendVerificationEmail } from "@lib/sendMail";
export type AuthUserSession = typeof auth.$Infer.Session;


//TODO: ALLOW users to setup if they want kv for sessions but highly suggest they dont
export const auth = betterAuth({
  plugins: [
    customSession(async ({ user, session }) => {
      let initial_site_setup = false;
      // //CONSIDER: Not using this?
      const userSites = await getSitesForUser(user.id);
      //
      let firstSite = 0;
      let db_adapter: DBAdapter = "sqlite";
      if (userSites) {
        if (userSites.sitesList.length > 0) {
          initial_site_setup = true;
        }
        //TODO: Handle this better
        firstSite = userSites.team.id;
        if (userSites.team.db_adapter) db_adapter = userSites.team.db_adapter;
      }

      return {
        initial_site_setup: initial_site_setup,
        team: firstSite,
        db_adapter,
        userSites: userSites?.sitesList,
        user,
        session
      };
    }),
  ],
  database: drizzleAdapter(d1_client, { provider: "sqlite", schema }),
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true
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
      console.log('Error from Api', error);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    //NEED a way to pass this is from users
    sendVerificationEmail: async ({ user, url }, _request) => {
      await sendVerificationEmail(user.email, url, env.FROM_EMAIL);
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
  //TODO: ALLOW users to pick
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  }
});
