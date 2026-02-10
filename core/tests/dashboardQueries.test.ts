import { expect, test } from "bun:test";


import {
  getDashboardSummary,
  getDeviceTypeMetrics,
  getEventTypeMetrics,
  getTimeSeriesByEvent,
  getTimeSeriesData,
  getTopPages,
  getTopReferers,
  getTotalEventCount,
} from "../src/utilities/dashboardQueries";

const sqliteAvailable = Boolean((Bun as any).sqlite);
const dbTest = sqliteAvailable ? test : test.skip;

dbTest("dashboardQueries (sqlite)", async () => {
  const { Database } = await import("bun:sqlite");
  const { drizzle } = await import("drizzle-orm/bun-sqlite");
  const { siteEvents } = await import("../src/session/siteSchema");

  const database = new Database(":memory:");
  database.exec(`
    CREATE TABLE site_events (
      id INTEGER PRIMARY KEY,
      tag_id TEXT,
      site_id INTEGER,
      team_id INTEGER,
      event TEXT,
      client_page_url TEXT,
      page_url TEXT,
      referer TEXT,
      browser TEXT,
      operating_system TEXT,
      device_type TEXT,
      country TEXT,
      region TEXT,
      city TEXT,
      screen_width INTEGER,
      screen_height INTEGER,
      rid TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

  const db = drizzle(database, { schema: { siteEvents } });
  const now = Math.floor(Date.now() / 1000);

  await (db as any).insert(siteEvents).values([
    {
      tag_id: "tag-1",
      site_id: 1,
      team_id: 1,
      event: "page_view",
      client_page_url: "/",
      page_url: "https://example.com/",
      referer: "https://google.com",
      browser: "Chrome",
      operating_system: "macOS",
      device_type: "desktop",
      country: "US",
      region: "CA",
      city: "SF",
      screen_width: 1200,
      screen_height: 800,
      rid: "rid-1",
      createdAt: now,
      updatedAt: now,
    },
    {
      tag_id: "tag-1",
      site_id: 1,
      team_id: 1,
      event: "conversion",
      client_page_url: "/pricing",
      page_url: "https://example.com/pricing",
      referer: "https://google.com",
      browser: "Chrome",
      operating_system: "macOS",
      device_type: "desktop",
      country: "US",
      region: "CA",
      city: "SF",
      screen_width: 1200,
      screen_height: 800,
      rid: "rid-2",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  const totalCount = await getTotalEventCount(db as any, {});
  expect(totalCount).toBe(2);

  const eventMetrics = await getEventTypeMetrics(db as any, {}, 2);
  expect(eventMetrics[0].percentage).toBe(50);

  const deviceMetrics = await getDeviceTypeMetrics(db as any, {});
  expect(deviceMetrics[0].label).toBe("desktop");

  const referers = await getTopReferers(db as any, {}, 1);
  expect(referers[0].label).toBe("google.com");

  const pages = await getTopPages(db as any, {}, 1);
  expect(pages[0].label).toBe("/");

  const timeSeries = await getTimeSeriesData(db as any, {}, "day");
  expect(timeSeries[0]?.count).toBe(2);

  const byEvent = await getTimeSeriesByEvent(db as any, {}, "day", 2);
  expect(byEvent.page_view?.[0]?.count).toBe(1);

  const summary = await getDashboardSummary(db as any, {});
  expect(summary.uniqueVisitors).toBe(2);

  database.close();
});

