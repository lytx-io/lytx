import { d1_client } from "@db/d1/client";
import { team_member, team, user, api_key, sites, invited_user, Permissions, AllowedMembers } from "@db/d1/schema";
import { and, desc, eq } from "drizzle-orm";

export async function updateTeamName(name: string, id: number) {
  const team_vals = await d1_client
    .update(team)
    .set({ name })
    .where(eq(team.id, id))
    .returning();
  return team_vals;
}

//TODO: Allow multi team
export async function userExists(email: string, team_id: number) {
  const userDetails = await d1_client
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (userDetails.length > 0) {
    //check if user is in team
    const [teamMember] = await d1_client
      .select()
      .from(team_member)
      .where(eq(team_member.user_id, userDetails[0].id))
      .limit(1);

    if (teamMember.team_id === team_id) {
      return { create: false, addToTeam: false, userDetails: userDetails[0] };
    } else return { create: false, addToTeam: true, userDetails: userDetails[0] };
  } else return { create: true, addToTeam: true, userDetails: null };
}

export async function getTeamMembers(team_id: number) {
  const team_members = await d1_client
    .select({
      id: team_member.user_id,
      name: user.name,
      email: user.email,
      role: team_member.role,
      allowed_site_ids: team_member.allowed_site_ids,
    })
    .from(team_member)
    .leftJoin(user, eq(team_member.user_id, user.id))
    .where(eq(team_member.team_id, team_id))
  return team_members;
}

export async function addTeamMember(user_id: string, team_id: number) {
  const new_member = await d1_client
    .insert(team_member)
    .values({
      user_id,
      team_id,
    })
    .returning();
  return new_member;
}


export async function getApiKeys(team_id: number) {
  const keyDetails = await d1_client
    .select()
    .from(api_key)
    .where(eq(api_key.team_id, team_id))
  return keyDetails;
}
export async function addApiKey(options: { team_id: number, site_id: number, permissions: Permissions, allowed_team_members?: AllowedMembers }) {
  const { team_id, site_id, permissions } = options;
  let allowed = options.allowed_team_members || ["all"];
  const new_key = await d1_client.insert(api_key).values({
    team_id,
    site_id,
    permissions,
    allowed_team_members: allowed,
  }).returning();
  return new_key;
}

export async function getTeamSites(team_id: number) {
  const team_sites = await d1_client
    .select({
      site_id: sites.site_id,
      name: sites.name,
      domain: sites.domain,
    })
    .from(sites)
    .where(eq(sites.team_id, team_id));
  return team_sites;
}

export async function getTeamPendingInvites(team_id: number) {
  const pendingInvites = await d1_client
    .select({
      id: invited_user.id,
      name: invited_user.name,
      email: invited_user.email,
      role: invited_user.role,
      createdAt: invited_user.createdAt,
    })
    .from(invited_user)
    .where(
      and(
        eq(invited_user.team_id, team_id),
        eq(invited_user.accepted, false),
      ),
    )
    .orderBy(desc(invited_user.createdAt));

  return pendingInvites;
}

export async function getTeamSettings(team_id: number) {
  const [members, keys, team_sites, pendingInvites] = await Promise.all([
    getTeamMembers(team_id),
    getApiKeys(team_id),
    getTeamSites(team_id),
    getTeamPendingInvites(team_id),
  ]);
  return { members, keys, sites: team_sites, pendingInvites };
}

export type GetTeamMembers = ReturnType<typeof getTeamMembers>;
export type GetTeamSites = ReturnType<typeof getTeamSites>;
export type GetTeamSettings = ReturnType<typeof getTeamSettings>;
