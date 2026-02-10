CREATE TABLE "accounts" (
	"account_id" serial PRIMARY KEY NOT NULL,
	"api_key" text,
	"created_at" timestamp,
	"created_by" text,
	"name" text,
	"website" text
);
--> statement-breakpoint
CREATE TABLE "dataStore" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"account" text,
	"adServer" text,
	"adServerData" jsonb,
	"adServerType" text,
	"city" text,
	"client_ip" text,
	"country" text,
	"created_at" timestamp,
	"customData" jsonb,
	"customType" text,
	"data_event" text,
	"data_passback" text,
	"host" text,
	"labels" text,
	"lat" text,
	"long" text,
	"message" text,
	"method" text,
	"path" text,
	"referer" text,
	"referrer" text,
	"region" text,
	"screen_height" text,
	"screen_width" text,
	"thirdPartyId" text,
	"user_agent" text,
	"zip" text
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"clickCease" jsonb,
	"condition" text,
	"created_at" timestamp,
	"data_passback" text,
	"event_name" text,
	"google_ads_conversion" jsonb,
	"google_ads_script" text,
	"google_analytics" text,
	"notes" text,
	"param_config" jsonb,
	"parameters" text,
	"quantcast_pixel_id" text,
	"rules" text,
	"simplfi_pixel_id" text,
	"site_id" integer
);
--> statement-breakpoint
CREATE TABLE "site_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"bot_data" jsonb,
	"browser" text,
	"city" text,
	"client_page_url" text,
	"country" text,
	"created_at" timestamp,
	"custom_data" jsonb,
	"device_type" text,
	"event" text,
	"operating_system" text,
	"page_url" text,
	"postal" text,
	"query_params" jsonb,
	"referer" text,
	"region" text,
	"rid" text,
	"screen_height" integer,
	"screen_width" integer,
	"site_id" integer,
	"tag_id" text
);
--> statement-breakpoint
CREATE TABLE "site_personalization" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp NOT NULL,
	"client_page_url" text,
	"rid" text
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"site_id" serial PRIMARY KEY NOT NULL,
	"tag_id" text NOT NULL,
	"track_web_events" boolean DEFAULT false NOT NULL,
	"event_load_strategy" text DEFAULT 'sdk' NOT NULL,
	"account_id" integer,
	"client" text,
	"created_at" timestamp,
	"domain" text,
	"gdpr" boolean,
	"rid_salt" text,
	"rid_salt_expire" timestamp,
	"tag_id_override" text
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"company" text,
	"created_at" timestamp,
	"email_address" text,
	"name" text,
	"website" text
);
