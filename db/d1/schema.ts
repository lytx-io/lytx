import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { randomName } from "@lib/random_name";
import { createId } from '@paralleldrive/cuid2';

const defaultThirtyDays = () => {
	const date = new Date();
	date.setDate(date.getDate() + 30); // 30 days from now
	return date;
}

export const user = sqliteTable("user", {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('email_verified', { mode: 'boolean' }).$defaultFn(() => false).notNull(),
	image: text('image'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull().$onUpdateFn(() => /* @__PURE__ */ new Date()),
});

export const session = sqliteTable("session", {
	id: text('id').primaryKey(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' })
});

export const account = sqliteTable("account", {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
});

export const verification = sqliteTable("verification", {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
});

export const team = sqliteTable('team', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	// api_key: text('api_key'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull().$onUpdateFn(() => /* @__PURE__ */ new Date()),
	/**User who created the team**/
	created_by: text('created_by').notNull(),
	name: text('name').$defaultFn(() => randomName()),
	uuid: text('uuid').$defaultFn(() => createId()),
	db_adapter: text({ enum: ['postgres', 'sqlite', 'singlestore'] }).default("sqlite").notNull(),
});


export const team_member = sqliteTable('team_member', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	team_id: integer('team_id').notNull(),
	//Tied to user table
	user_id: text('user_id').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
});

export const sites = sqliteTable('sites', {
	site_id: integer('site_id').primaryKey({ autoIncrement: true }),
	tag_id: text('tag_id').$defaultFn(() => createId()).notNull(),
	track_web_events: integer('track_web_events', { mode: 'boolean' }).notNull().default(false),
	team_id: integer('team_id').notNull(),
	name: text('name'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull().$onUpdateFn(() => /* @__PURE__ */ new Date()),
	domain: text('domain'),
	//Might not need
	gdpr: integer('gdpr', { mode: 'boolean' }),
	rid_salt: text('rid_salt').$defaultFn(() => createId()),
	rid_salt_expire: integer('rid_salt_expire', { mode: 'timestamp' }).$defaultFn(() => defaultThirtyDays()),
	/**@deprecated**/
	tag_id_override: text('tag_id_override'),
});

//CONSIDER: Breaking this up into multiple tables
export const siteEvents = sqliteTable('site_events', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	team_id: integer('team_id'),
	bot_data: text('bot_data', { mode: 'json' }),
	browser: text('browser'),
	city: text('city'),
	client_page_url: text('client_page_url'),
	country: text('country'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull().$onUpdateFn(() => /* @__PURE__ */ new Date()),
	custom_data: text('custom_data', { mode: 'json' }),
	device_type: text('device_type'),
	event: text('event').notNull(),
	operating_system: text('operating_system'),
	page_url: text('page_url'),
	postal: text('postal'),
	query_params: text('query_params', { mode: 'json' }),
	referer: text('referer'),
	region: text('region'),
	rid: text('rid'),
	screen_height: integer('screen_height'),
	screen_width: integer('screen_width'),
	site_id: integer('site_id').notNull(),
	tag_id: text('tag_id').notNull(),
});


export type SiteInsert = typeof sites.$inferInsert;
export type TeamInsert = typeof team.$inferInsert;
export type DBAdapter = NonNullable<TeamInsert["db_adapter"]>;
