import { d1_client } from "@db/d1/client";
import { team_member, team, sites, siteEvents, type SiteInsert } from "@db/d1/schema";
import { and, eq, gte, lte } from 'drizzle-orm';
import type { webEvent } from "@/templates/trackWebEvents";
import type { AuthUserSession } from "@lib/auth";
import { DashboardOptions } from "@db/types";
export async function createNewAccount(user: AuthUserSession["user"]) {
	try {
		const [newTeam] = await d1_client.insert(team).values({
			created_by: user.id,
		}).returning();
		const [teamMember] = await d1_client.insert(team_member).values({
			team_id: newTeam.id,
			user_id: user.id,
		}).returning();
		return { newTeam, teamMember };

	} catch (e) {
		console.log('🔥🔥🔥 createNewAccount error', e);
		return null;
	}
}


export async function getSitesForUser(user_id: string) {
	try {
		const [userTeam] = await d1_client
			.select({ team_id: team_member.team_id, db_adapter: team.db_adapter })
			.from(team_member)
			.leftJoin(team, eq(team.id, team_member.team_id))
			.where(eq(team_member.user_id, user_id));

		const sitesList = await d1_client
			.select()
			.from(sites)
			.where(eq(sites.team_id, userTeam.team_id));

		return { sitesList, team: { id: userTeam.team_id, db_adapter: userTeam.db_adapter } };
	} catch (e) {
		console.log('🔥🔥🔥 getSiteCount error', e);
		return null;
	}
}


export async function getDashboardData(options: DashboardOptions) {
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
			whereFilters.push(gte(siteEvents.createdAt, date.start));
		}
		if (date.end) {
			whereFilters.push(lte(siteEvents.createdAt, date.end));
		}
	} else {
		// Default to last 7 days
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		whereFilters.push(gte(siteEvents.createdAt, sevenDaysAgo));
	}
	query.where(and(...whereFilters));
	return query;

}

export async function createSite(data: SiteInsert) {
	const { name, domain, track_web_events, gdpr, team_id } = data;
	if (!team_id) throw new Error('team_id is required');
	try {
		const [newSite] = await d1_client.insert(sites).values({
			name,
			domain,
			track_web_events,
			gdpr,
			team_id
		}).returning();
		return newSite;
	} catch (e) {
		console.log('🔥🔥🔥 createSite error', e);
		return null;
	}
}

//WARNING: THIS IS ONLY FOR LOADING INTO THE TAG DO NOT USE THIS FOR ANYTHING ELSE
export async function getSiteForTag(account: string) {
	const [site] = await d1_client
		.select()
		.from(sites)
		.where(eq(siteEvents.tag_id, account))
		.limit(1);
	return site;
}


export async function insertSiteEvent(event: webEvent) {
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
