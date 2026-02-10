import { describe, expect, test } from "bun:test";

import { transformToChartData } from "../db/tranformReports";

describe("transformToChartData scorecards", () => {
	test("computes uniques, total page views, bounce & conversion", () => {
		const now = new Date("2026-01-14T00:00:00.000Z");

		const data: any[] = [
			// rid-1: single page_view (bounce)
			{
				rid: "rid-1",
				event: "page_view",
				createdAt: new Date(now.getTime() + 1000),
				referer: "",
				device_type: "desktop",
				country: "US",
				city: "New York",
				browser: "Chrome",
				client_page_url: "https://pw.local/",
			},
			// rid-2: two page views (not bounce)
			{
				rid: "rid-2",
				event: "page_view",
				createdAt: new Date(now.getTime() + 2000),
				referer: "https://google.com",
				device_type: "mobile",
				country: "CA",
				city: "Toronto",
				browser: "Safari",
				client_page_url: "https://pw.local/pricing",
			},
			{
				rid: "rid-2",
				event: "page_view",
				createdAt: new Date(now.getTime() + 3000),
				referer: "https://google.com",
				device_type: "mobile",
				country: "CA",
				city: "Toronto",
				browser: "Safari",
				client_page_url: "https://pw.local/pricing",
			},
			// rid-3: one page_view + conversion (still bounce per current logic)
			{
				rid: "rid-3",
				event: "page_view",
				createdAt: new Date(now.getTime() + 4000),
				referer: "https://facebook.com",
				device_type: "tablet",
				country: "US",
				city: "Austin",
				browser: "Firefox",
				client_page_url: "https://pw.local/checkout",
			},
			{
				rid: "rid-3",
				event: "conversion",
				createdAt: new Date(now.getTime() + 5000),
				referer: "https://facebook.com",
				device_type: "tablet",
				country: "US",
				city: "Austin",
				browser: "Firefox",
				client_page_url: "https://pw.local/checkout",
			},
		];

		const transformed = transformToChartData(data as any);
		const scorecards = transformed.scoreCards;

		const uniques = scorecards.find((s: any) => s.title === "Uniques");
		const pageViews = scorecards.find((s: any) => s.title === "Total Page Views");
		const bounceRate = scorecards.find((s: any) => s.title === "Bounce Rate");
		const conversionRate = scorecards.find(
			(s: any) => s.title === "Conversion Rate",
		);

		expect(uniques?.value).toBe("3");
		expect(pageViews?.value).toBe("4");
		// 2 single-page sessions out of 3 => 66.7%
		expect(bounceRate?.value).toBe("66.7%");
		// 1 conversion out of 3 uniques => 33.33%
		expect(conversionRate?.value).toBe("33.33%");
	});
});
