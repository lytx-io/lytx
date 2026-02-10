import { pg_client } from "@db/postgres/client";
import { DashboardOptions } from "@db/types";
import { siteEvents, sites } from "@db/postgres/schema";
import { and, count, eq, gte, inArray, lte } from 'drizzle-orm';
import { WebEvent } from "@/templates/trackWebEvents";
import { IS_DEV } from "rwsdk/constants";


export function getDashboardData(options: DashboardOptions) {
	const { date, site_id, team_id } = options;
	const client = pg_client();
	let parsedSiteId = site_id;
	const query = client.select({
		page_url: siteEvents.page_url,
		client_page_url: siteEvents.client_page_url,
		referer: siteEvents.referer,
		event: siteEvents.event,
		createdAt: siteEvents.created_at,
		operating_system: siteEvents.operating_system,
		browser: siteEvents.browser,
		country: siteEvents.country,
		region: siteEvents.region,
		rid: siteEvents.rid,
		city: siteEvents.city,
		postal: siteEvents.postal,
		screen_width: siteEvents.screen_width,
		screen_height: siteEvents.screen_height,
		device_type: siteEvents.device_type,
	}).from(siteEvents);
	const whereFilters = [eq(siteEvents.account_id, team_id)];
	if (typeof site_id === 'string') {
		whereFilters.push(eq(siteEvents.tag_id, site_id));
	}
	else {
		whereFilters.push(eq(siteEvents.site_id, site_id));
	}
	if (date) {
		if (date.start) {
			whereFilters.push(gte(siteEvents.created_at, date.start));
		}
		if (date.end) {
			// Set end date to end of day (23:59:59.999) to include the entire day
			const endOfDay = new Date(date.end);
			endOfDay.setHours(23, 59, 59, 999);
			whereFilters.push(lte(siteEvents.created_at, endOfDay));
		}
	} else {
		// Default to last 7 days
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		whereFilters.push(gte(siteEvents.created_at, sevenDaysAgo));
	}
	const noSiteRecordsExist = checkIfSiteEventsHaveRows(site_id, client);

	query.where(and(...whereFilters));
	if (IS_DEV) console.log("🔥🔥🔥 getDashboardData", query.toSQL());
	return { query, client, noSiteRecordsExist: noSiteRecordsExist };
}


//WARNING: THIS IS ONLY FOR LOADING INTO THE TAG DO NOT USE THIS FOR ANYTHING ELSE
export async function getSiteForTag(account: string) {
	const client = pg_client();
	const [site] = await client
		.select()
		.from(sites)
		.where(eq(siteEvents.tag_id, account))
		.limit(1);
	return site;
}


export async function insertSiteEvent(event: WebEvent) {
	const client = pg_client();

	const [newEvent] = await client.insert(siteEvents).values({
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
		//TODO:RENAME TEAM_ID TO ACCOUNT_ID
		account_id: event.account_id,
	}).returning();
	return newEvent;

}

export async function checkIfSiteEventsHaveRows(site_id: number | string, client: ReturnType<typeof pg_client>) {
	const whereFilters = [];
	if (typeof site_id === 'string') {
		whereFilters.push(eq(siteEvents.tag_id, site_id));
	}
	else {
		whereFilters.push(eq(siteEvents.site_id, site_id));
	}
	const siteEv = await client
		.select({ id: siteEvents.id })
		.from(siteEvents)
		.where(and(...whereFilters))
		.limit(1);
	if (siteEv.length == 0) return true;
	return false;
}
