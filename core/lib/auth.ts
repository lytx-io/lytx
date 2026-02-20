import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession } from "better-auth/plugins";
import { env } from "cloudflare:workers";
import { IS_DEV } from "rwsdk/constants";
import { and, eq } from "drizzle-orm";

import { d1_client } from "@db/d1/client";
import type { DBAdapter } from "@db/d1/schema";
import * as schema from "@db/d1/schema";
import { invited_user, user as user_table } from "@db/d1/schema";
import { createNewAccount, getSitesForUser } from "@db/d1/sites";
import type { SitesContext } from "@db/d1/sites";
import { sendVerificationEmail } from "@lib/sendMail";

type SocialProviderToggles = {
  google?: boolean;
  github?: boolean;
};

export const SIGNUP_MODES = ["open", "bootstrap_then_invite", "invite_only"] as const;
export type SignupMode = (typeof SIGNUP_MODES)[number];

export type SignupAccessState = {
  mode: SignupMode;
  hasUsers: boolean;
  publicSignupOpen: boolean;
  bootstrapSignupOpen: boolean;
};

export type AuthRuntimeConfig = {
  emailPasswordEnabled?: boolean;
  requireEmailVerification?: boolean;
  socialProviders?: SocialProviderToggles;
  signupMode?: SignupMode;
};

type TeamSummary = {
  id: number;
  name: string;
  external_id: number;
};

type CoreSession = {
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type AuthUserSession = CoreSession & {
  initial_site_setup: boolean;
  email_verified: boolean;
  team: TeamSummary;
  all_teams: TeamSummary[];
  role: "admin" | "editor" | "viewer";
  db_adapter: DBAdapter;
  userSites: SitesContext | undefined;
  timezone: string | null;
  last_site_id: number | null;
  last_team_id: number | null;
};

export type AuthProviderAvailability = {
  google: boolean;
  github: boolean;
};

const DEFAULT_AUTH_RUNTIME_CONFIG: AuthRuntimeConfig = {
  emailPasswordEnabled: true,
  requireEmailVerification: true,
  signupMode: "bootstrap_then_invite",
  socialProviders: {},
};

let auth_runtime_config: AuthRuntimeConfig = {
  ...DEFAULT_AUTH_RUNTIME_CONFIG,
};

let auth_instance: ReturnType<typeof betterAuth> | null = null;

const hasGoogleCredentials = () => Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
const hasGithubCredentials = () => Boolean(env.GITHUB_CLIENT_ID?.trim() && env.GITHUB_CLIENT_SECRET?.trim());

export function setAuthRuntimeConfig(config: AuthRuntimeConfig = {}) {
  const socialProviders = {
    ...DEFAULT_AUTH_RUNTIME_CONFIG.socialProviders,
    ...config.socialProviders,
  };

  auth_runtime_config = {
    ...DEFAULT_AUTH_RUNTIME_CONFIG,
    ...config,
    socialProviders,
  };

  auth_instance = null;
}

export function getAuthProviderAvailability(): AuthProviderAvailability {
  const google_enabled = auth_runtime_config.socialProviders?.google ?? hasGoogleCredentials();
  const github_enabled = auth_runtime_config.socialProviders?.github ?? hasGithubCredentials();

  return {
    google: google_enabled,
    github: github_enabled,
  };
}

function getSignupMode(): SignupMode {
  return auth_runtime_config.signupMode ?? "bootstrap_then_invite";
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.includes("no such table");
}

async function hasAnyUserAccount(): Promise<boolean> {
  try {
    const users = await d1_client.select({ id: user_table.id }).from(user_table).limit(1);
    return typeof users[0]?.id === "string";
  } catch (error) {
    if (isMissingTableError(error)) {
      if (IS_DEV) {
        console.warn("Signup bootstrap check: user table missing, treating as zero users");
      }
      return false;
    }
    throw error;
  }
}

async function hasPendingInviteForEmail(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  try {
    const invites = await d1_client
      .select({ id: invited_user.id })
      .from(invited_user)
      .where(and(eq(invited_user.email, normalizedEmail), eq(invited_user.accepted, false)))
      .limit(1);

    return typeof invites[0]?.id === "number";
  } catch (error) {
    if (isMissingTableError(error)) {
      if (IS_DEV) {
        console.warn("Signup invite check: invited_user table missing, treating as no invite");
      }
      return false;
    }
    throw error;
  }
}

export async function getSignupAccessState(): Promise<SignupAccessState> {
  const mode = getSignupMode();

  if (mode === "open") {
    return {
      mode,
      hasUsers: true,
      publicSignupOpen: true,
      bootstrapSignupOpen: false,
    };
  }

  if (mode === "invite_only") {
    return {
      mode,
      hasUsers: true,
      publicSignupOpen: false,
      bootstrapSignupOpen: false,
    };
  }

  const hasUsers = await hasAnyUserAccount();
  return {
    mode,
    hasUsers,
    publicSignupOpen: !hasUsers,
    bootstrapSignupOpen: !hasUsers,
  };
}

export async function isPublicSignupOpen(): Promise<boolean> {
  const state = await getSignupAccessState();
  return state.publicSignupOpen;
}

export async function canRegisterEmail(email: string): Promise<boolean> {
  const signupMode = getSignupMode();
  if (signupMode === "open") return true;

  const invited = await hasPendingInviteForEmail(email);
  if (invited) return true;

  if (signupMode === "invite_only") return false;
  const state = await getSignupAccessState();
  return state.bootstrapSignupOpen;
}

function getTrustedOrigins() {
  if (!IS_DEV) return [env.BETTER_AUTH_URL];
  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:6124",
    "http://localhost:6123",
    "http://*.ts.net:*",
    "https://*.ts.net:*",
    env.BETTER_AUTH_URL,
  ];
}

function buildSocialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};
  const availability = getAuthProviderAvailability();

  if (availability.google) {
    const clientId = env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error("Google sign-in is enabled but GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are missing");
    }
    providers.google = { clientId, clientSecret };
  }

  if (availability.github) {
    const clientId = env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = env.GITHUB_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error("GitHub sign-in is enabled but GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET are missing");
    }
    providers.github = { clientId, clientSecret };
  }

  return providers;
}

function createAuthInstance() {
  return betterAuth({
    trustedOrigins: getTrustedOrigins(),
    plugins: [
      customSession(async ({ user, session }) => {
        const user_with_state = user as typeof user & {
          last_team_id?: number | null;
          timezone?: string | null;
          last_site_id?: number | null;
        };

        let initial_site_setup = false;
        const lastTeamId = user_with_state.last_team_id ?? null;
        const userSites = await getSitesForUser(user.id, lastTeamId);

        let currentTeamId = 0;
        let currentTeamName = "";
        let db_adapter: DBAdapter = "sqlite";
        let teamExternalId = 0;
        let userRole = "viewer";
        if (userSites) {
          if (userSites.teamHasSites) {
            initial_site_setup = true;
          }
          currentTeamId = userSites.team.id;

          if (userSites.team.name) currentTeamName = userSites.team.name;
          if (userSites.team.db_adapter) db_adapter = userSites.team.db_adapter;
          if (userSites.team.external_id) teamExternalId = userSites.team.external_id;
          if (userSites.team.role) userRole = userSites.team.role;
        }

        const teams = [{ id: currentTeamId, name: currentTeamName, external_id: teamExternalId }];
        if (userSites?.all_teams) {
          const mappedTeams = userSites.all_teams.map((team) => ({
            id: team.team_id,
            name: team.name!,
            external_id: team.external_id!,
          }));
          teams.push(...mappedTeams);
        }

        return {
          initial_site_setup,
          email_verified: user.emailVerified,
          team: { id: currentTeamId, name: currentTeamName, external_id: teamExternalId },
          all_teams: teams,
          role: userRole,
          db_adapter,
          userSites: userSites?.sitesList,
          timezone: user_with_state.timezone ?? null,
          last_site_id: user_with_state.last_site_id ?? null,
          last_team_id: currentTeamId || lastTeamId,
          user,
          session,
        };
      }),
    ],
    database: drizzleAdapter(d1_client, { provider: "sqlite", schema }),
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: auth_runtime_config.emailPasswordEnabled ?? true,
      requireEmailVerification: auth_runtime_config.requireEmailVerification ?? true,
    },
    rateLimit: {
      storage: "secondary-storage",
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
    user: {},
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }, _request) => {
        if (IS_DEV) console.log("🔥🔥🔥 sendVerificationEmail", user, url);
        await sendVerificationEmail(user.email, url);
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (userRecord) => {
            const email = typeof userRecord.email === "string" ? userRecord.email : "";
            const allowed = await canRegisterEmail(email);
            if (!allowed) {
              throw new Error("Public sign up is disabled. Ask an admin for an invitation.");
            }
          },
          after: async (user) => {
            await createNewAccount(user);
          },
        },
      },
    },
    socialProviders: buildSocialProviders(),
  });
}

export function getAuth() {
  if (!auth_instance) {
    auth_instance = createAuthInstance();
  }
  return auth_instance;
}

export type AuthInstance = ReturnType<typeof getAuth>;

export const auth: AuthInstance = new Proxy({} as AuthInstance, {
  get(_target, property, receiver) {
    return Reflect.get(getAuth(), property, receiver);
  },
});

export function asAuthUserSession(value: unknown): AuthUserSession | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AuthUserSession>;
  if (!candidate.user || !candidate.session) return null;
  if (!candidate.team || !candidate.role || !candidate.db_adapter) return null;
  return candidate as AuthUserSession;
}
