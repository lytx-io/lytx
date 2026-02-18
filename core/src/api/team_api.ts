import { route, prefix } from "rwsdk/router";
import type { RequestInfo } from "rwsdk/worker";
import type { AppContext } from "@/types/app-context";
import type { UserRole } from "@db/types";
import { IS_DEV } from "rwsdk/constants";
import { onlyAllowPost } from "@utilities/route_interuptors";
import { updateTeamName, getTeamMembers, userExists, getTeamSettings, addApiKey } from "@db/d1/teams";
import { d1_client } from "@db/d1/client";
import { type AllowedMembers, type Permissions, type AllowedSiteIds, invited_user, team, team_member } from "@db/d1/schema";
import { and, eq } from "drizzle-orm";
import { newAccountInviteEmail, sendTeamInviteEmail } from "@lib/sendMail";
import * as schema from "@db/d1/schema";
import { getSiteFromContext } from "@/api/authMiddleware";
// import { auth } from "@lib/auth";

type TeamRequestInfo = RequestInfo<any, AppContext>;
const teamRoute = <TPath extends string>(
  path: TPath,
  handlers: Parameters<typeof route<TPath, TeamRequestInfo>>[1],
) => route<TPath, TeamRequestInfo>(path, handlers);

//PERF:  ALL ROUTES HERE WILL BE PREFIXED WITH /api/team
export const get_team_members = () =>
  teamRoute("/members", [
    async ({ ctx }) => {
      const teamMembers = await getTeamMembers(ctx.team.id)
      if (teamMembers.length === 0) {
        return new Response("No team members found", { status: 404 });
      } else {
        return new Response(JSON.stringify(teamMembers), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  ]);
export const get_team_settings = () =>
  teamRoute("/settings", [
    async ({ ctx }) => {
      const { members, keys, sites, pendingInvites } = await getTeamSettings(ctx.team.id);
      if (members.length === 0) {
        return new Response("No team members found", { status: 404 });
      } else {
        return new Response(JSON.stringify({ members, keys, sites, pendingInvites }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  ]);
type Team_Option = "name";
const update_team = teamRoute("/update", [
  onlyAllowPost,
  async ({ ctx, request }) => {
    if (IS_DEV)
      console.log(
        "🔥🔥🔥 Team update endpoint hit",
        request.method,
        request.url,
      );
    //create a type that can recieve other team values
    const body = (await request.json()) as {
      option: Team_Option;
      name: string;
    };
    if (!body.option || !body.name)
      return new Response("Invalid request", { status: 400 });
    const checkIfUpdated = await updateTeamName(body.name, ctx.team.id);
    if (body.option === "name" && IS_DEV) {
      console.log("Team name updated", checkIfUpdated, ctx.team);
    }
    if (IS_DEV) console.log(checkIfUpdated, ctx.team, body.option, body.name);
    return new Response("Ok", { status: 201 });
    //return new Response("Not Found.", { status: 404 });
  },
]);

const add_api_key = teamRoute("/add-api-key", [
  onlyAllowPost,
  async ({ ctx, request }) => {
    if (IS_DEV)
      console.log(
        "🔥🔥🔥 Add team member endpoint hit",
        request.method,
        request.url,
      );
    //check 
    const body = await request.json() as {
      site_id?: number;
      permissions: Permissions;
      allowed_team_members?: AllowedMembers;
    };
    if (!body.permissions) {
      return new Response("Invalid request need permissions", { status: 400 });
    }
    if (typeof body.site_id !== "number" || !Number.isInteger(body.site_id)) {
      return new Response("Invalid request need site_id", { status: 400 });
    }
    if (ctx.user_role !== "admin") {
      return new Response("You must be an admin to add an API key", { status: 400 });
    }
    const siteDetails = getSiteFromContext(ctx, body.site_id);
    if (!siteDetails) {
      return new Response("Invalid site_id for current team", { status: 403 });
    }
    const checkIfUpdated = await addApiKey(
      {
        team_id: ctx.team.id,
        site_id: body.site_id,
        permissions: body.permissions,
        allowed_team_members: body.allowed_team_members ?? undefined
      }
    );
    if (IS_DEV) console.log(checkIfUpdated, ctx.team,);
    return new Response(JSON.stringify(checkIfUpdated), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }
]);
const add_team_member = teamRoute("/add-member", [
  onlyAllowPost,
  async ({ ctx, request }) => {
    if (IS_DEV)
      console.log(
        "🔥🔥🔥 Add team member endpoint hit",
        request.method,
        request.url,
      );
    //check 
    const body = (await request.json()) as { email: string, name: string, role: UserRole };
    const domainUrl = new URL(request.url);
    if (!body.email) {
      return new Response("Missing user_id", { status: 400 });
    }
    if (ctx.user_role !== "admin") {
      return new Response("You must be an admin to add team members", { status: 403 });
    }

    const normalizedEmail = body.email.trim().toLowerCase();

    const existingInvite = await d1_client
      .select({ id: invited_user.id })
      .from(invited_user)
      .where(
        and(
          eq(invited_user.team_id, ctx.team.id),
          eq(invited_user.email, normalizedEmail),
          eq(invited_user.accepted, false),
        ),
      )
      .limit(1);

    if (existingInvite.length > 0) {
      return new Response("Invitation already pending for this email", { status: 409 });
    }

    const { create, addToTeam, userDetails } = await userExists(normalizedEmail, ctx.team.id);
    if (IS_DEV) console.log(create, addToTeam, userDetails);

    if (!create && !addToTeam) {
      return new Response("User already exists", { status: 400 });
    }

    if (addToTeam && userDetails) {
      await d1_client.insert(team_member).values({
        team_id: ctx.team.id,
        user_id: userDetails.id,
        role: body.role,
      });
      await newAccountInviteEmail(normalizedEmail, `${domainUrl.host}/login`);
      return new Response(JSON.stringify({ success: true, inviteSent: true, memberVisible: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (create && !userDetails) {
      await d1_client.insert(invited_user).values({
        team_id: ctx.team.id,
        email: normalizedEmail,
        name: body.name,
        role: body.role,
        accepted: false,
      });

      await sendTeamInviteEmail(normalizedEmail, `${domainUrl.host}/signup`);
      return new Response(JSON.stringify({ success: true, inviteSent: true, memberVisible: false }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("Failed to add team member", { status: 400 });

  },
]);

const create_team = teamRoute("/create", [
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

    const { name } = body as { name?: unknown };
    if (typeof name !== "string" || !name.trim()) {
      return new Response(JSON.stringify({ error: "name is required", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return new Response(JSON.stringify({ error: "name must be 2-80 characters", requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const [newTeam] = await d1_client
        .insert(team)
        .values({
          name: trimmedName,
          created_by: ctx.session.user.id,
        })
        .returning();

      if (!newTeam) {
        return new Response(JSON.stringify({ error: "Failed to create team", requestId }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      await d1_client.insert(team_member).values({
        team_id: newTeam.id,
        user_id: ctx.session.user.id,
        role: "admin",
      });

      return new Response(
        JSON.stringify({ team_id: newTeam.id, name: newTeam.name, requestId }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Create team error:", { requestId, error });
      return new Response(JSON.stringify({ error: "Internal server error", requestId }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
]);

const update_member_sites = teamRoute(
  "/update-member-sites",
  [
    onlyAllowPost,
    async ({ ctx, request }) => {
      const body = (await request.json()) as {
        user_id?: string;
        allowed_site_ids?: AllowedSiteIds;
      };

      if (!body.user_id || !body.allowed_site_ids) {
        return new Response("Invalid request", { status: 400 });
      }

      if (ctx.user_role !== "admin") {
        return new Response("You must be an admin to update member sites", {
          status: 403,
        });
      }

      const allowed = body.allowed_site_ids;
      if (!Array.isArray(allowed)) {
        return new Response("allowed_site_ids must be an array", { status: 400 });
      }

      const allowedSiteIds = allowed
        .filter((id): id is number => typeof id === "number" && Number.isInteger(id));

      if (!allowed.includes("all") && allowedSiteIds.length !== allowed.length) {
        return new Response(
          "allowed_site_ids must be 'all' or a list of site ids",
          { status: 400 },
        );
      }

      if (!allowed.includes("all") && allowedSiteIds.length > 0) {
        const teamSites = await d1_client
          .select({ site_id: schema.sites.site_id })
          .from(schema.sites)
          .where(eq(schema.sites.team_id, ctx.team.id));
        const teamSiteIds = new Set(teamSites.map((s) => s.site_id));

        const invalidIds = allowedSiteIds.filter((id) => !teamSiteIds.has(id));
        if (invalidIds.length > 0) {
          return new Response(
            `Invalid site ids: ${invalidIds.join(", ")}`,
            { status: 400 },
          );
        }
      }

      const updated = await d1_client
        .update(team_member)
        .set({ allowed_site_ids: allowed })
        .where(
          and(
            eq(team_member.team_id, ctx.team.id),
            eq(team_member.user_id, body.user_id),
          ),
        )
        .returning();

      if (updated.length === 0) {
        return new Response("Team member not found", { status: 404 });
      }

      return new Response(JSON.stringify(updated[0]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  ],
);

const update_member_role = teamRoute(
  "/update-member-role",
  [
    onlyAllowPost,
    async ({ ctx, request }) => {
      const body = (await request.json()) as {
        user_id?: string;
        role?: UserRole;
      };

      if (!body.user_id || !body.role) {
        return new Response("Invalid request", { status: 400 });
      }

      if (!["admin", "editor", "viewer"].includes(body.role)) {
        return new Response("Invalid role", { status: 400 });
      }

      if (ctx.user_role !== "admin") {
        return new Response("You must be an admin to update member roles", {
          status: 403,
        });
      }

      const updated = await d1_client
        .update(team_member)
        .set({ role: body.role })
        .where(
          and(
            eq(team_member.team_id, ctx.team.id),
            eq(team_member.user_id, body.user_id),
          ),
        )
        .returning();

      if (updated.length === 0) {
        return new Response("Team member not found", { status: 404 });
      }

      return new Response(JSON.stringify(updated[0]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  ],
);

const remove_pending_invite = teamRoute(
  "/remove-pending-invite",
  [
    onlyAllowPost,
    async ({ ctx, request }) => {
      const body = (await request.json()) as {
        invite_id?: number;
      };

      if (!Number.isInteger(body.invite_id)) {
        return new Response("Invalid invite_id", { status: 400 });
      }

      if (ctx.user_role !== "admin") {
        return new Response("You must be an admin to remove pending invites", {
          status: 403,
        });
      }

      const inviteId = body.invite_id as number;
      const targetInvite = await d1_client
        .select({ id: invited_user.id })
        .from(invited_user)
        .where(
          and(
            eq(invited_user.team_id, ctx.team.id),
            eq(invited_user.id, inviteId),
          ),
        )
        .limit(1);

      if (targetInvite.length === 0) {
        return new Response("Pending invite not found", { status: 404 });
      }

      await d1_client
        .delete(invited_user)
        .where(
          and(
            eq(invited_user.team_id, ctx.team.id),
            eq(invited_user.id, inviteId),
          ),
        );

      return new Response(JSON.stringify({ success: true, invite_id: inviteId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  ],
);

export const team_dashboard_endpoints = prefix<"/team", TeamRequestInfo>("/team", [
  get_team_members(),
  update_team,
  create_team,
  add_team_member,
  get_team_settings(),
  add_api_key,
  update_member_sites,
  update_member_role,
  remove_pending_invite,
]);
