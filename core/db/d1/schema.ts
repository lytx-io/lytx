import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { randomName } from "@lib/random_name";
import { createId } from "@paralleldrive/cuid2";
import { events } from "@db/postgres/schema";
const enumRoles = ["viewer", "editor", "admin"] as const;
export type UserRole = typeof enumRoles[number];

export const enumAdapters = [
  "postgres",
  "sqlite",
  "singlestore",
  "analytics_engine",
] as const;

const defaultThirtyDays = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30); // 30 days from now
  return date;
};

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  timezone: text("timezone"),
  last_site_id: integer("last_site_id"),
  last_team_id: integer("last_team_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull()
    .$onUpdateFn(() => /* @__PURE__ */ new Date()),
});

export const invited_user = sqliteTable(
  "invited_user",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    team_id: integer("team_id").notNull(),
    accepted: integer("accepted", { mode: "boolean" })
      .$defaultFn(() => false)
      .notNull(),
    email: text("email").notNull().unique(),
    role: text({ enum: enumRoles }).default("editor").notNull(),
    name: text("name"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull()
      .$onUpdateFn(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    index("invited_user_team_id_idx").on(table.team_id),
    index("invited_user_email_idx").on(table.email),
  ],
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    index("session_token_idx").on(table.token),
  ],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull()
      .$onUpdateFn(() => /* @__PURE__ */ new Date()),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull()
    .$onUpdateFn(() => /* @__PURE__ */ new Date()),
});

export const team = sqliteTable("team", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  //NOTE: only used for third party integrations
  external_id: integer("external_id").default(0).notNull(),
  // api_key: text('api_key'),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull()
    .$onUpdateFn(() => /* @__PURE__ */ new Date()),
  /**User who created the team**/
  created_by: text("created_by").notNull(),
  name: text("name").$defaultFn(() => randomName()),
  uuid: text("uuid").$defaultFn(() => createId()),
  db_adapter: text({ enum: enumAdapters }).default("sqlite").notNull(),
});

export type AllowedSiteIds = Array<number | "all">;

export const team_member = sqliteTable(
  "team_member",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    team_id: integer("team_id").notNull(),
    role: text({ enum: ["viewer", "editor", "admin"] })
      .default("editor")
      .notNull(),
    //Tied to user table
    user_id: text("user_id").notNull(),
    allowed_site_ids: text("allowed_site_ids", { mode: "json" })
      .$type<AllowedSiteIds>()
      .default(["all"]),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull()
      .$onUpdateFn(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    index("team_member_team_id_idx").on(table.team_id),
    index("team_member_user_id_idx").on(table.user_id),
    index("team_member_team_user_idx").on(table.team_id, table.user_id),
  ],
);
export type AllowedMembers = Array<string>;
export type Permissions = {
  read: boolean,
  write: boolean,
};
export const api_key = sqliteTable(
  "api_key",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").$defaultFn(() => createId()),
    team_id: integer("team_id").notNull(),
    site_id: integer("site_id"),
    enabled: integer("enabled", { mode: "boolean" }).default(true),
    permissions: text("permissions", { mode: "json" }).$type<Permissions>().default({ read: true, write: true }).notNull(),
    allowed_team_members: text("allowed_team_members", { mode: "json" }).$type<AllowedMembers>().default([]),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull()
      .$onUpdateFn(() => /* @__PURE__ */ new Date()),
  },
  (table) => [
    index("api_key_team_id_idx").on(table.team_id),
    index("api_key_site_id_idx").on(table.site_id),
  ],
);

export const team_ai_usage = sqliteTable(
  "team_ai_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    team_id: integer("team_id").notNull(),
    user_id: text("user_id"),
    site_id: integer("site_id"),
    request_id: text("request_id"),
    request_type: text({ enum: ["chat", "site_tag_suggest"] }).notNull(),
    provider: text("provider"),
    model: text("model"),
    status: text({ enum: ["success", "error"] })
      .default("success")
      .notNull(),
    error_code: text("error_code"),
    error_message: text("error_message"),
    input_tokens: integer("input_tokens"),
    output_tokens: integer("output_tokens"),
    total_tokens: integer("total_tokens"),
    tool_calls: integer("tool_calls"),
    message_count: integer("message_count"),
    prompt_chars: integer("prompt_chars"),
    completion_chars: integer("completion_chars"),
    duration_ms: integer("duration_ms"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("team_ai_usage_team_id_idx").on(table.team_id),
    index("team_ai_usage_team_created_idx").on(table.team_id, table.createdAt),
    index("team_ai_usage_team_type_created_idx").on(table.team_id, table.request_type, table.createdAt),
    index("team_ai_usage_request_id_idx").on(table.request_id),
    index("team_ai_usage_user_created_idx").on(table.user_id, table.createdAt),
  ],
);
export const sites = sqliteTable(
  "sites",
  {
    site_id: integer("site_id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid").$defaultFn(() => createId()).notNull(),
    tag_id: text("tag_id")
      .$defaultFn(() => createId())
      .notNull(),
    track_web_events: integer("track_web_events", { mode: "boolean" })
      .notNull()
      .default(false),
    gdpr: integer("gdpr", { mode: "boolean" }).default(false),
    event_load_strategy: text("event_load_strategy")
      .notNull()
      .default("sdk"),
    //NOTE: only used for third party integrations
    external_id: integer("external_id").default(0).notNull(),
    //NOTE: if this is set this overrides the team overall db adapter
    site_db_adapter: text({ enum: enumAdapters }).default("sqlite").notNull(),
    team_id: integer("team_id").notNull(),
    name: text("name"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull()
      .$onUpdateFn(() => /* @__PURE__ */ new Date()),
    domain: text("domain"),
    //Might not need
    tag_manager: integer("tag_manager", { mode: "boolean" }).default(false),
    // Autocapture: automatically track clicks on links, buttons, and form submissions
    autocapture: integer("autocapture", { mode: "boolean" }).default(true),
    rid_salt: text("rid_salt").$defaultFn(() => createId()),
    rid_salt_expire: integer("rid_salt_expire", {
      mode: "timestamp",
    }).$defaultFn(() => defaultThirtyDays()),
    /**@deprecated**/
    tag_id_override: text("tag_id_override"),
  },
  (table) => [
    index("sites_team_id_idx").on(table.team_id),
    index("sites_tag_id_idx").on(table.tag_id),
    index("sites_domain_idx").on(table.domain),
  ],
);

//CONSIDER: Breaking this up into multiple tables
export const siteEvents = sqliteTable(
  "site_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    team_id: integer("team_id"),
    bot_data: text("bot_data", { mode: "json" }).$type<Record<string, string>>(),
    browser: text("browser"),
    city: text("city"),
    client_page_url: text("client_page_url"),
    country: text("country"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull()
      .$onUpdateFn(() => /* @__PURE__ */ new Date()),
    custom_data: text("custom_data", { mode: "json" }).$type<Record<string, string>>(),
    device_type: text("device_type"),
    event: text("event").notNull(),
    operating_system: text("operating_system"),
    page_url: text("page_url"),
    postal: text("postal"),
    query_params: text("query_params", { mode: "json" }).$type<Record<string, string>>(),
    referer: text("referer"),
    region: text("region"),
    rid: text("rid"),
    screen_height: integer("screen_height"),
    screen_width: integer("screen_width"),
    site_id: integer("site_id").notNull(),
    tag_id: text("tag_id").notNull(),
  },
  (table) => [
    // Primary query patterns from dashboard API
    index("site_events_team_id_idx").on(table.team_id),
    index("site_events_site_id_idx").on(table.site_id),
    index("site_events_tag_id_idx").on(table.tag_id),
    index("site_events_created_at_idx").on(table.createdAt),

    // Composite indexes for common query patterns
    index("site_events_team_site_idx").on(table.team_id, table.site_id),
    index("site_events_team_tag_idx").on(table.team_id, table.tag_id),
    index("site_events_site_created_idx").on(table.site_id, table.createdAt),
    index("site_events_team_created_idx").on(table.team_id, table.createdAt),

    // Analytics filtering indexes
    index("site_events_country_idx").on(table.country),
    index("site_events_device_type_idx").on(table.device_type),
    index("site_events_event_idx").on(table.event),
    index("site_events_referer_idx").on(table.referer),
  ],
);

// Event labels for renaming/labeling autocaptured events
export const eventLabels = sqliteTable(
  "event_labels",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    site_id: integer("site_id").notNull(),
    event_name: text("event_name").notNull(), // Original event name (e.g., "$ac_link_SignUp_btn1")
    label: text("label").notNull(), // User-defined label (e.g., "Sign Up Button")
    description: text("description"), // Optional description
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("event_labels_site_id_idx").on(table.site_id),
    index("event_labels_site_event_idx").on(table.site_id, table.event_name),
  ],
);

export const customReports = sqliteTable(
  "custom_reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    uuid: text("uuid").notNull().unique(),
    team_id: integer("team_id").notNull(),
    site_id: integer("site_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    config: text("config", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    created_by: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("custom_reports_team_id_idx").on(table.team_id),
    index("custom_reports_site_id_idx").on(table.site_id),
    index("custom_reports_team_site_idx").on(table.team_id, table.site_id),
  ],
);

export type EventLabelInsert = typeof eventLabels.$inferInsert;
export type EventLabelSelect = typeof eventLabels.$inferSelect;
export type CustomReportInsert = typeof customReports.$inferInsert;
export type CustomReportSelect = typeof customReports.$inferSelect;
export type TeamAiUsageInsert = typeof team_ai_usage.$inferInsert;
export type TeamAiUsageSelect = typeof team_ai_usage.$inferSelect;

export type SiteInsert = typeof sites.$inferInsert;
export type TeamInsert = typeof team.$inferInsert;
export type ApiKeyInsert = typeof api_key.$inferInsert;
export type DBAdapter = NonNullable<TeamInsert["db_adapter"]>;
export type EventSelect = typeof siteEvents.$inferSelect;
