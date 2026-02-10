import { siteEvents } from "@db/d1/schema";
export { siteEvents };
export type SiteEvent = typeof siteEvents.$inferSelect;
export type SiteEventInsert = typeof siteEvents.$inferInsert;
export type SiteEventSelect = typeof siteEvents.$inferSelect;
