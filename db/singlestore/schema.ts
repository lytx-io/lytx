import {
  mysqlTable,
  varchar,
  int,
  boolean,
  timestamp,
  json,
  text,
} from "drizzle-orm/mysql-core";
import { randomName } from "@lib/random_name";
import { createId } from "@paralleldrive/cuid2";

const defaultThirtyDays = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30); // 30 days from now
  return date;
};

export const user = mysqlTable("user", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: varchar("image", { length: 500 }),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const session = mysqlTable("session", {
  id: varchar("id", { length: 255 }).primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: varchar("token", { length: 500 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  userId: varchar("user_id", { length: 255 }).notNull(),
});

export const account = mysqlTable("account", {
  id: varchar("id", { length: 255 }).primaryKey(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: varchar("scope", { length: 500 }),
  password: varchar("password", { length: 255 }),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const verification = mysqlTable("verification", {
  id: varchar("id", { length: 255 }).primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const team = mysqlTable("team", {
  id: int("id").primaryKey().autoincrement(),
  // api_key: varchar('api_key', { length: 255 }),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull()
    .$onUpdateFn(() => new Date()),
  /**User who created the team**/
  created_by: varchar("created_by", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).$defaultFn(() => randomName()),
  uuid: varchar("uuid", { length: 255 }).$defaultFn(() => createId()),
  db_adapter: varchar("db_adapter", {
    length: 50,
    enum: ["postgres", "sqlite", "singlestore"],
  })
    .default("sqlite")
    .notNull(),
});

export const team_member = mysqlTable("team_member", {
  id: int("id").primaryKey().autoincrement(),
  team_id: int("team_id").notNull(),
  //Tied to user table
  user_id: varchar("user_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const sites = mysqlTable("sites", {
  site_id: int("site_id").primaryKey().autoincrement(),
  tag_id: varchar("tag_id", { length: 255 })
    .$defaultFn(() => createId())
    .notNull(),
  track_web_events: boolean("track_web_events").notNull().default(false),
  team_id: int("team_id").notNull(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull()
    .$onUpdateFn(() => new Date()),
  domain: varchar("domain", { length: 255 }),
  //Might not need
  gdpr: boolean("gdpr"),
  rid_salt: varchar("rid_salt", { length: 255 }).$defaultFn(() => createId()),
  rid_salt_expire: timestamp("rid_salt_expire").$defaultFn(() =>
    defaultThirtyDays(),
  ),
  /**@deprecated**/
  tag_id_override: varchar("tag_id_override", { length: 255 }),
});

//CONSIDER: Breaking this up into multiple tables
export const siteEvents = mysqlTable("site_events", {
  id: int("id").primaryKey().autoincrement(),
  team_id: int("team_id"),
  bot_data: json("bot_data"),
  browser: varchar("browser", { length: 100 }),
  city: varchar("city", { length: 100 }),
  client_page_url: text("client_page_url"),
  country: varchar("country", { length: 100 }),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull()
    .$onUpdateFn(() => new Date()),
  custom_data: json("custom_data"),
  device_type: varchar("device_type", { length: 50 }),
  event: varchar("event", { length: 100 }).notNull(),
  operating_system: varchar("operating_system", { length: 100 }),
  page_url: text("page_url"),
  postal: varchar("postal", { length: 20 }),
  query_params: json("query_params"),
  referer: text("referer"),
  region: varchar("region", { length: 100 }),
  rid: varchar("rid", { length: 255 }),
  screen_height: int("screen_height"),
  screen_width: int("screen_width"),
  site_id: int("site_id").notNull(),
  tag_id: varchar("tag_id", { length: 255 }).notNull(),
});

export type SiteInsert = typeof sites.$inferInsert;
export type TeamInsert = typeof team.$inferInsert;
export type DBAdapter = NonNullable<TeamInsert["db_adapter"]>;
