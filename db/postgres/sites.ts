import { pg_client } from "@db/postgres/client";
import { DashboardOptions } from "@db/types";
import { siteEvents } from "@db/postgres/schema";
import { and, count, eq, gte, inArray, lte } from 'drizzle-orm';


export async function getDashboardData(options: DashboardOptions) {
	const { date, site_id, team_id } = options;
	const client = pg_client();
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
			whereFilters.push(lte(siteEvents.created_at, date.end));
		}
	} else {
		// Default to last 7 days
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		whereFilters.push(gte(siteEvents.created_at, sevenDaysAgo));
	}
	query.where(and(...whereFilters));
	return { query, client };
}

