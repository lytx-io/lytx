import { pgTable, serial, integer, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

export const accounts = pgTable('accounts', {
	account_id: serial('account_id').primaryKey(),
	api_key: text('api_key'),
	created_at: timestamp('created_at'),
	created_by: text('created_by'),
	name: text('name'),
	website: text('website'),
})

export const dataStore = pgTable('dataStore', {
	id: serial('id').primaryKey(),
	uuid: text('uuid').notNull(),
	account: text('account'),
	adServer: text('adServer'),
	adServerData: jsonb('adServerData'),
	adServerType: text('adServerType'),
	city: text('city'),
	client_ip: text('client_ip'),
	country: text('country'),
	created_at: timestamp('created_at'),
	customData: jsonb('customData'),
	customType: text('customType'),
	data_event: text('data_event'),
	data_passback: text('data_passback'),
	host: text('host'),
	labels: text('labels'),
	lat: text('lat'),
	long: text('long'),
	message: text('message'),
	method: text('method'),
	path: text('path'),
	referer: text('referer'),
	referrer: text('referrer'),
	region: text('region'),
	screen_height: text('screen_height'),
	screen_width: text('screen_width'),
	thirdPartyId: text('thirdPartyId'),
	user_agent: text('user_agent'),
	zip: text('zip'),
})

export const sites = pgTable('sites', {
	site_id: serial('site_id').primaryKey(),
	tag_id: text('tag_id').default(sql`uuid_generate_v4()`),
	track_web_events: boolean('track_web_events').notNull().default(false),
	event_load_strategy: text('event_load_strategy').notNull().default('sdk'),
	account_id: integer('account_id'),
	client: text('client'),
	created_at: timestamp('created_at'),
	domain: text('domain'),
	gdpr: boolean('gdpr'),
	// Autocapture: automatically track clicks on links, buttons, and form submissions
	autocapture: boolean('autocapture').default(true),
	rid_salt: text('rid_salt'),
	rid_salt_expire: timestamp('rid_salt_expire'),
	tag_id_override: text('tag_id_override'),
})

export const events = pgTable('events', {
	id: serial('id').primaryKey(),
	account_id: integer('account_id'),
	clickCease: jsonb('clickCease'),
	condition: text('condition'),
	created_at: timestamp('created_at'),
	data_passback: text('data_passback'),
	event_name: text('event_name'),
	google_ads_conversion: jsonb('google_ads_conversion'),
	google_ads_script: text('google_ads_script'),
	google_analytics: text('google_analytics'),
	notes: text('notes'),
	param_config: jsonb('param_config'),
	parameters: text('parameters'),
	quantcast_pixel_id: text('quantcast_pixel_id'),
	rules: text('rules'),
	simplfi_pixel_id: text('simplfi_pixel_id'),
	site_id: integer('site_id'),
})

export const siteEvents = pgTable('site_events', {
	id: serial('id').primaryKey(),
	account_id: integer('account_id'),
	bot_data: jsonb('bot_data'),
	browser: text('browser'),
	city: text('city'),
	client_page_url: text('client_page_url'),
	country: text('country'),
	created_at: timestamp('created_at'),
	custom_data: jsonb('custom_data'),
	device_type: text('device_type'),
	event: text('event'),
	operating_system: text('operating_system'),
	page_url: text('page_url'),
	postal: text('postal'),
	query_params: jsonb('query_params'),
	referer: text('referer'),
	region: text('region'),
	rid: text('rid'),
	screen_height: integer('screen_height'),
	screen_width: integer('screen_width'),
	site_id: integer('site_id'),
	tag_id: text('tag_id'),
})

export const sitePersonalization = pgTable('site_personalization', {
	id: serial('id').primaryKey(),
	created_at: timestamp('created_at').notNull(),
	client_page_url: text('client_page_url'),
	rid: text('rid'),
})

export const waitlist = pgTable('waitlist', {
	id: serial('id').primaryKey(),
	company: text('company'),
	created_at: timestamp('created_at'),
	email_address: text('email_address'),
	name: text('name'),
	website: text('website'),
})

export const accountsRelations = relations(accounts, ({ many }) => ({
	sites: many(sites),
	events: many(events),
}))

export const sitesRelations = relations(sites, ({ one, many }) => ({
	account: one(accounts, {
		fields: [sites.account_id],
		references: [accounts.account_id],
	}),
	events: many(events),
}))

export const eventsRelations = relations(events, ({ one }) => ({
	account: one(accounts, {
		fields: [events.account_id],
		references: [accounts.account_id],
	}),
	site: one(sites, {
		fields: [events.site_id],
		references: [sites.site_id],
	}),
}))
