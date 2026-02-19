import { route, prefix } from "rwsdk/router";
import { env } from "cloudflare:workers";
import { getAuth } from "@lib/auth";
import { d1_client } from "@db/d1/client";
import { team_member, user as userTable } from "@db/d1/schema";
import { getSitesForUser } from "@db/d1/sites";
import { and, eq } from "drizzle-orm";
import { sessionMiddleware } from "./authMiddleware";
import { onlyAllowPost } from "@utilities/route_interuptors";

function getClientIp(request: Request) {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) return cfIp;

  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (!forwardedFor) return "unknown";

  return forwardedFor.split(",")[0]?.trim() || "unknown";
}

function validateCallbackURL(callbackURL: unknown) {
  if (callbackURL === undefined) return undefined;
  if (typeof callbackURL !== "string") return null;

  // Prevent open redirects by only allowing relative URLs.
  if (!callbackURL.startsWith("/")) return null;
  if (callbackURL.includes("://")) return null;

  return callbackURL;
}

/**
 * POST /api/resend-verification-email
 *
 * Proxies Better Auth's `/api/auth/send-verification-email` with app-level
 * rate limiting to prevent abuse.
 */
export const resendVerificationEmailRoute = route(
  "/api/resend-verification-email",
  async ({ request }) => {
    const requestId = crypto.randomUUID();

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed", requestId }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid request body", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { email, callbackURL } = body as { email?: unknown; callbackURL?: unknown };

    if (typeof email !== "string" || !email.trim()) {
      return new Response(JSON.stringify({ error: "email is required", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const safeCallbackURL = validateCallbackURL(callbackURL);
    if (safeCallbackURL === null) {
      return new Response(
        JSON.stringify({ error: "callbackURL must be a relative path", requestId }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const ip = getClientIp(request);
    const rateLimitKey = `rate_limit:resend_verification:${ip}:${normalizedEmail}`;

    try {
      const existing = await env.lytx_sessions.get(rateLimitKey);
      if (existing) {
        // Avoid account enumeration: do not reveal rate limiting either.
        return new Response(JSON.stringify({ status: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      await env.lytx_sessions.put(rateLimitKey, "1", { expirationTtl: 60 });

      const proxyUrl = new URL("/api/auth/send-verification-email", request.url);
      const proxyHeaders = new Headers(request.headers);
      proxyHeaders.set("Content-Type", "application/json");

      const proxyRequest = new Request(proxyUrl, {
        method: "POST",
        headers: proxyHeaders,
        body: JSON.stringify({
          email: normalizedEmail,
          callbackURL: safeCallbackURL ?? "/dashboard",
        }),
      });

      const auth = getAuth();
      const proxyResponse = await auth.handler(proxyRequest);

      // Avoid account enumeration: always return 200 for common failures.
      if (proxyResponse.status === 400 || proxyResponse.status === 403) {
        return new Response(JSON.stringify({ status: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return proxyResponse;
    } catch (error) {
      console.error("Resend verification email API error:", { requestId, error });
      return new Response(JSON.stringify({ error: "Internal server error", requestId }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
);

/**
 * POST /api/user/update-timezone
 *
 * Updates the user's timezone preference.
 */
const updateTimezoneRoute = route(
  "/update-timezone",
  [
    sessionMiddleware,
    onlyAllowPost,
    async ({ ctx, request }) => {
      const requestId = crypto.randomUUID();

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON", requestId }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!body || typeof body !== "object") {
        return new Response(JSON.stringify({ error: "Invalid request body", requestId }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { timezone } = body as { timezone?: unknown };

      if (typeof timezone !== "string" || !timezone.trim()) {
        return new Response(JSON.stringify({ error: "timezone is required", requestId }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Validate timezone is a valid IANA timezone
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch {
        return new Response(JSON.stringify({ error: "Invalid timezone", requestId }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = ctx.session.user.id;

      try {
        await d1_client
          .update(userTable)
          .set({ timezone: timezone.trim() })
          .where(eq(userTable.id, userId));

        return new Response(JSON.stringify({ success: true, timezone: timezone.trim() }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Update timezone error:", { requestId, error });
        return new Response(JSON.stringify({ error: "Internal server error", requestId }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    },
  ],
);

/**
 * POST /api/user/update-last-site
 *
 * Updates the user's last selected site.
 */
const updateLastSiteRoute = route(
  "/update-last-site",
  [
    sessionMiddleware,
    onlyAllowPost,
    async ({ ctx, request }) => {
      const requestId = crypto.randomUUID();

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON", requestId }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!body || typeof body !== "object") {
        return new Response(JSON.stringify({ error: "Invalid request body", requestId }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { site_id } = body as { site_id?: unknown };

      if (typeof site_id !== "number" || !Number.isInteger(site_id)) {
        return new Response(JSON.stringify({ error: "site_id must be an integer", requestId }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify the site_id belongs to the user's accessible sites
      const userSites = ctx.session.userSites || [];
      const isValidSite = userSites.some((site: { site_id: number }) => site.site_id === site_id);
      
      if (!isValidSite) {
        return new Response(JSON.stringify({ error: "Invalid site_id", requestId }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = ctx.session.user.id;

      try {
        await d1_client
          .update(userTable)
          .set({ last_site_id: site_id })
          .where(eq(userTable.id, userId));

        return new Response(JSON.stringify({ success: true, site_id }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Update last site error:", { requestId, error });
        return new Response(JSON.stringify({ error: "Internal server error", requestId }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    },
  ],
);

/**
 * POST /api/user/update-last-team
 *
 * Updates the user's last selected team and refreshes session cache.
 */
const updateLastTeamRoute = route(
  "/update-last-team",
  [
    sessionMiddleware,
    onlyAllowPost,
    async ({ ctx, request }) => {
      const requestId = crypto.randomUUID();

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON", requestId }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!body || typeof body !== "object") {
        return new Response(JSON.stringify({ error: "Invalid request body", requestId }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { team_id } = body as { team_id?: unknown };

      if (typeof team_id !== "number" || !Number.isInteger(team_id)) {
        return new Response(JSON.stringify({ error: "team_id must be an integer", requestId }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = ctx.session.user.id;

      const membership = await d1_client
        .select({ id: team_member.id })
        .from(team_member)
        .where(and(eq(team_member.user_id, userId), eq(team_member.team_id, team_id)))
        .limit(1);

      if (membership.length === 0) {
        return new Response(JSON.stringify({ error: "Invalid team_id", requestId }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const userSites = await getSitesForUser(userId, team_id);
        if (!userSites) {
          return new Response(JSON.stringify({ error: "Team not found", requestId }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        const nextSiteId = userSites.sitesList[0]?.site_id ?? null;

        await d1_client
          .update(userTable)
          .set({ last_team_id: team_id, last_site_id: nextSiteId })
          .where(eq(userTable.id, userId));

        const teamContext = userSites.team;
        const updatedTeams = [
          { id: teamContext.id, name: teamContext.name, external_id: teamContext.external_id },
        ];
        if (userSites.all_teams?.length) {
          updatedTeams.push(
            ...userSites.all_teams.map((team) => ({
              id: team.team_id,
              name: team.name!,
              external_id: team.external_id!,
            })),
          );
        }

        const updatedSession = {
          ...ctx.session,
          initial_site_setup: userSites.teamHasSites,
          team: {
            id: teamContext.id,
            name: teamContext.name,
            external_id: teamContext.external_id,
          },
          all_teams: updatedTeams,
          role: teamContext.role ?? ctx.session.role,
          db_adapter: teamContext.db_adapter ?? ctx.session.db_adapter,
          userSites: userSites.sitesList,
          last_team_id: team_id,
          last_site_id: nextSiteId,
        };
        const updatedUser = {
          ...ctx.session.user,
          last_team_id: team_id,
          last_site_id: nextSiteId,
        };
        const updatedSessionCache = {
          ...updatedSession,
          user: updatedUser,
        };

        const sessionToken = ctx.session.session?.token;
        const sessionId = ctx.session.session?.id;
        const expiresAt = ctx.session.session?.expiresAt;
        let expirationTtl: number | undefined;
        if (expiresAt) {
          const expiresAtMs =
            expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
          if (!Number.isNaN(expiresAtMs)) {
            const ttlSeconds = Math.floor((expiresAtMs - Date.now()) / 1000);
            if (ttlSeconds > 0) expirationTtl = ttlSeconds;
          }
        }

        const candidateKeys = [
          sessionToken ? `session:${sessionToken}` : null,
          sessionToken || null,
          sessionId ? `session:${sessionId}` : null,
          sessionId || null,
        ].filter(Boolean) as string[];

        let updatedCache = false;
        for (const key of candidateKeys) {
          const existing = await env.lytx_sessions.get(key);
          if (!existing) continue;
          if (expirationTtl) {
            await env.lytx_sessions.put(key, JSON.stringify(updatedSessionCache), {
              expirationTtl,
            });
          } else {
            await env.lytx_sessions.put(key, JSON.stringify(updatedSessionCache));
          }
          updatedCache = true;
          break;
        }

        if (!updatedCache && sessionToken) {
          if (expirationTtl) {
            await env.lytx_sessions.put(sessionToken, JSON.stringify(updatedSessionCache), {
              expirationTtl,
            });
          } else {
            await env.lytx_sessions.put(sessionToken, JSON.stringify(updatedSessionCache));
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            team_id,
            team: updatedSession.team,
            userSites: userSites.sitesList,
            last_site_id: nextSiteId,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        console.error("Update last team error:", { requestId, error });
        return new Response(JSON.stringify({ error: "Internal server error", requestId }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    },
  ],
);

export const userApiRoutes = prefix("/api/user", [
  updateTimezoneRoute,
  updateLastSiteRoute,
  updateLastTeamRoute,
]);
