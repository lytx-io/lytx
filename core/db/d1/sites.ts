import { d1_client } from "@db/d1/client";
import { team_member, team, sites, siteEvents, invited_user, type SiteInsert } from "@db/d1/schema";
import { createId } from "@paralleldrive/cuid2";
import { and, asc, count, eq, gte, lte } from "drizzle-orm";
import type { WebEvent } from "@/templates/trackWebEvents";
import type { AuthUserSession } from "@lib/auth";
import { DashboardOptions } from "@db/types";
import { IS_DEV } from "rwsdk/constants";

export async function createNewAccount(user: AuthUserSession["user"]) {
	const normalized_email = user.email.trim().toLowerCase();

	const [pending_invite] = await d1_client
		.select()
		.from(invited_user)
		.where(and(eq(invited_user.email, normalized_email), eq(invited_user.accepted, false)))
		.limit(1);

	if (pending_invite) {
		const [teamMember] = await d1_client
			.insert(team_member)
			.values({
				team_id: pending_invite.team_id,
				user_id: user.id,
				role: pending_invite.role ?? "editor",
			})
			.onConflictDoNothing({ target: [team_member.team_id, team_member.user_id] })
			.returning();

		await d1_client
			.update(invited_user)
			.set({ accepted: true })
			.where(eq(invited_user.id, pending_invite.id));

		if (!teamMember) {
			const [existingMembership] = await d1_client
				.select()
				.from(team_member)
				.where(
					and(
						eq(team_member.team_id, pending_invite.team_id),
						eq(team_member.user_id, user.id),
					),
				)
				.limit(1);

			return { newTeam: null, teamMember: existingMembership ?? null };
		}

		return { newTeam: null, teamMember };
	}

	const [primary_team] = await d1_client
		.select({ id: team.id })
		.from(team)
		.orderBy(asc(team.id))
		.limit(1);

	if (primary_team) {
		const [teamMember] = await d1_client
			.insert(team_member)
			.values({
				team_id: primary_team.id,
				user_id: user.id,
				role: "viewer",
			})
			.onConflictDoNothing({ target: [team_member.team_id, team_member.user_id] })
			.returning();

		if (teamMember) return { newTeam: null, teamMember };

		const [existingMembership] = await d1_client
			.select()
			.from(team_member)
			.where(
				and(
					eq(team_member.team_id, primary_team.id),
					eq(team_member.user_id, user.id),
				),
			)
			.limit(1);

		return { newTeam: null, teamMember: existingMembership ?? null };
	}

	try {
		const [newTeam] = await d1_client
			.insert(team)
			.values({ created_by: user.id })
			.returning();

		const [first_team_now] = await d1_client
			.select({ id: team.id })
			.from(team)
			.orderBy(asc(team.id))
			.limit(1);

		if (first_team_now && first_team_now.id !== newTeam.id) {
			await d1_client.delete(team).where(eq(team.id, newTeam.id));

			const [teamMember] = await d1_client
				.insert(team_member)
				.values({
					team_id: first_team_now.id,
					user_id: user.id,
					role: "viewer",
				})
				.onConflictDoNothing({ target: [team_member.team_id, team_member.user_id] })
				.returning();

			if (teamMember) return { newTeam: null, teamMember };

			const [existingMembership] = await d1_client
				.select()
				.from(team_member)
				.where(
					and(
						eq(team_member.team_id, first_team_now.id),
						eq(team_member.user_id, user.id),
					),
				)
				.limit(1);

			return { newTeam: null, teamMember: existingMembership ?? null };
		}

		const [teamMember] = await d1_client.insert(team_member).values({
			team_id: newTeam.id,
			user_id: user.id,
			role: "admin",
		}).returning();

		return { newTeam, teamMember };
	} catch (e) {
		if (IS_DEV) console.log("🔥🔥🔥 createNewAccount error", e);
		return null;
	}
}

export async function getSitesForUser(user_id: string, preferredTeamId?: number | null) {
	try {
		const userTeams = await d1_client
			.select({
				team_id: team_member.team_id,
				role: team_member.role,
				allowed_site_ids: team_member.allowed_site_ids,
				db_adapter: team.db_adapter,
				name: team.name, external_id: team.external_id,
			})
			.from(team_member)
			.leftJoin(team, eq(team.id, team_member.team_id))
			.where(eq(team_member.user_id, user_id));

		if (userTeams.length === 0) return null;
		const preferredTeam =
			preferredTeamId != null
				? userTeams.find((team) => team.team_id === preferredTeamId)
				: null;
		const userTeam = preferredTeam ?? userTeams[0];
		const allSites = await d1_client
			.select()
			.from(sites)
			.where(eq(sites.team_id, userTeam.team_id));

		const allowedSiteIds = userTeam.allowed_site_ids ?? ["all"];
		const sitesList = allowedSiteIds.includes("all")
			? allSites
			: allSites.filter((site) => allowedSiteIds.includes(site.site_id));
		const normalizedSites = sitesList.map((site) => ({
			...site,
			event_load_strategy: site.event_load_strategy ?? "sdk",
			gdpr: site.gdpr ?? false,
		}));

		const remainingTeams = userTeams.filter(
			(team) => team.team_id !== userTeam.team_id,
		);

		return {
			sitesList: normalizedSites,
			teamHasSites: allSites.length > 0,
			all_teams: remainingTeams,
			team: {
				id: userTeam.team_id,
				role: userTeam.role,
				db_adapter: userTeam.db_adapter,
				external_id: userTeam.external_id,
				name: userTeam.name
			}
		};
	} catch (e) {
		if (IS_DEV) console.log('🔥🔥🔥 getSiteCount error', e);
		return null;
	}
}

export async function checkIfSiteEventsHaveRows(site_id: number | string) {
	const whereFilters = [];
	if (typeof site_id === 'string') {
		whereFilters.push(eq(siteEvents.tag_id, site_id));
	}
	else {
		whereFilters.push(eq(siteEvents.site_id, site_id));
	}
	const siteEv = await d1_client
		.select({ id: siteEvents.id })
		.from(siteEvents)
		.where(and(...whereFilters))
		.limit(1);
	if (siteEv.length == 0) return true;
	return false;
}


export async function getDashboardData(options: DashboardOptions) {
	if (IS_DEV) console.log("🔥🔥🔥 getDashboardData", options);
	const { date, site_id, team_id } = options;
	const query = d1_client.select({
		page_url: siteEvents.page_url,
		client_page_url: siteEvents.client_page_url,
		referer: siteEvents.referer,
		event: siteEvents.event,
		createdAt: siteEvents.createdAt,
		operating_system: siteEvents.operating_system,
		browser: siteEvents.browser,
		country: siteEvents.country,
		region: siteEvents.region,
		city: siteEvents.city,
		rid: siteEvents.rid,
		postal: siteEvents.postal,
		screen_width: siteEvents.screen_width,
		screen_height: siteEvents.screen_height,
		device_type: siteEvents.device_type,
	}).from(siteEvents);
	const whereFilters = [eq(siteEvents.team_id, team_id)];
	if (typeof site_id === 'string') {
		whereFilters.push(eq(siteEvents.tag_id, site_id));
	}
	else {
		whereFilters.push(eq(siteEvents.site_id, site_id));
	}
	if (date) {
		if (date.start) {
			// whereFilters.push(sql`${siteEvents.createdAt}/1000 >= ${date.start.getTime() / 1000}`)
			whereFilters.push(gte(siteEvents.createdAt, date.start));
		}
		if (date.end) {
			// Set end date to end of day (23:59:59.999) to include the entire day
			const endOfDay = new Date(date.end);
			endOfDay.setHours(23, 59, 59, 999);
			// whereFilters.push(sql`${siteEvents.createdAt}/1000 <= ${date.end.getTime() / 1000}`)
			whereFilters.push(lte(siteEvents.createdAt, endOfDay));
		}
	} else {
		// Default to last 7 days
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		// whereFilters.push(sql`${siteEvents.createdAt}/1000 >= ${sevenDaysAgo.getTime() / 1000}`)
		whereFilters.push(gte(siteEvents.createdAt, sevenDaysAgo));
	}

	const noSiteRecordsExist = checkIfSiteEventsHaveRows(site_id)
	query.where(and(...whereFilters));
	if (IS_DEV) console.log(query.toSQL())
	return { query, client: null, noSiteRecordsExist };

}

export async function createSite(data: SiteInsert) {
		const { name, domain, track_web_events, gdpr, team_id, event_load_strategy } = data;
	if (!team_id) throw new Error('team_id is required');
	try {
		const [newSite] = await d1_client.insert(sites).values({
			name,
			domain,
			track_web_events,
			event_load_strategy,
			gdpr,
			team_id
		}).returning();
		return newSite;
	} catch (e) {
		if (IS_DEV) console.log('🔥🔥🔥 createSite error', e);
		return null;
	}
}


//WARNING: THIS IS ONLY FOR LOADING INTO THE TAG DO NOT USE THIS FOR ANYTHING ELSE
export async function getSiteForTag(account: string) {
	const [site] = await d1_client
		.select()
		.from(sites)
		.where(eq(sites.tag_id, account))
		.limit(1);
	return site;
}


export async function insertSiteEvent(event: WebEvent) {
	const [newEvent] = await d1_client.insert(siteEvents).values({
		event: event.event!,
		tag_id: event.tag_id!,
		client_page_url: event.client_page_url,
		screen_height: event.screen_height,
		screen_width: event.screen_width,
		rid: event.rid,
		browser: event.browser,
		operating_system: event.operating_system,
		device_type: event.device_type,
		custom_data: event.custom_data,
		country: event.country,
		region: event.region,
		city: event.city,
		postal: event.postal,
		site_id: event.site_id!,
		page_url: event.page_url,
		bot_data: event.bot_data,
		query_params: event.query_params,
		referer: event.referer,
		team_id: event.account_id,

	}).returning();
	return newEvent;

}

export type SiteRidConfig = {
	site_id: number;
	rid_salt: string | null;
	rid_salt_expire: Date | null;
};

function buildRidSaltExpireDate(base = new Date()): Date {
	const date = new Date(base);
	date.setDate(date.getDate() + 30);
	return date;
}

export async function getSiteRidConfig(site_id: number): Promise<SiteRidConfig | null> {
	const [site] = await d1_client
		.select({
			site_id: sites.site_id,
			rid_salt: sites.rid_salt,
			rid_salt_expire: sites.rid_salt_expire,
		})
		.from(sites)
		.where(eq(sites.site_id, site_id))
		.limit(1);
	return site ?? null;
}

export async function rotateSiteRidSalt(site_id: number): Promise<SiteRidConfig | null> {
	const nextSalt = createId();
	const nextExpire = buildRidSaltExpireDate();
	const [updated] = await d1_client
		.update(sites)
		.set({
			rid_salt: nextSalt,
			rid_salt_expire: nextExpire,
			updatedAt: new Date(),
		})
		.where(eq(sites.site_id, site_id))
		.returning({
			site_id: sites.site_id,
			rid_salt: sites.rid_salt,
			rid_salt_expire: sites.rid_salt_expire,
		});
	return updated ?? null;
}

export type GetSitesForUser = Awaited<ReturnType<typeof getSitesForUser>>
export type SitesContext = NonNullable<GetSitesForUser>["sitesList"];
export type TeamContext = Omit<NonNullable<GetSitesForUser>["team"], "role" | "db_adapter">;
