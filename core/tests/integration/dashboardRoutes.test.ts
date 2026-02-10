import { describe, expect, test } from "bun:test";

const baseUrl = process.env.INTEGRATION_BASE_URL ?? "";
const seedSecret = process.env.SEED_DATA_SECRET ?? "";
const sessionCookie = process.env.INTEGRATION_SESSION_COOKIE ?? "";

const shouldRun = Boolean(baseUrl && seedSecret);
const integrationTest = shouldRun ? test : test.skip;
const authIntegrationTest = baseUrl && seedSecret && sessionCookie ? test : test.skip;

describe("dashboard integration", () => {
  integrationTest("seeds events through events API", async () => {
    const response = await fetch(`${baseUrl}/api/events/5`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-seed-secret": seedSecret,
      },
      body: JSON.stringify([
        {
          event: "page_view",
          tag_id: "seed-tag",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { message?: string };
    expect(body.message).toBe("Events saved successfully");
  });

  integrationTest("redirects dashboard data without session", async () => {
    const response = await fetch(`${baseUrl}/api/dashboard/data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: 5 }),
      redirect: "manual",
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login");
  });

  authIntegrationTest("returns dashboard data with session", async () => {
    const response = await fetch(`${baseUrl}/api/dashboard/data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ site_id: 5 }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });

  integrationTest("serves legacy container script", async () => {
    const response = await fetch(`${baseUrl}/container.js`, {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/javascript");
  });

  integrationTest("rejects resend verification email GET", async () => {
    const response = await fetch(`${baseUrl}/api/resend-verification-email`, {
      method: "GET",
    });

    expect(response.status).toBe(405);
  });

  integrationTest("rejects tag script without account", async () => {
    const response = await fetch(`${baseUrl}/lytx.js`, {
      method: "GET",
    });

    expect(response.status).toBe(404);
  });

  integrationTest("rejects trackWebEvent without account", async () => {
    const response = await fetch(
      `${baseUrl}/trackWebEvent?account=missing&platform=web`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referer: "",
          event: "page_view",
          client_page_url: "https://example.com",
          screen_width: 1200,
          screen_height: 800,
        }),
      },
    );

    expect(response.status).toBe(404);
  });

  integrationTest("rejects v2 tag script without account", async () => {
    const response = await fetch(`${baseUrl}/lytx.v2.js`, {
      method: "GET",
    });

    expect(response.status).toBe(404);
  });

  integrationTest("rejects trackWebEvent v2 without account", async () => {
    const response = await fetch(
      `${baseUrl}/trackWebEvent.v2?account=missing&platform=web`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referer: "",
          event: "page_view",
          client_page_url: "https://example.com",
          screen_width: 1200,
          screen_height: 800,
        }),
      },
    );

    expect(response.status).toBe(404);
  });

  authIntegrationTest("loads dashboard page with session", async () => {
    const response = await fetch(`${baseUrl}/dashboard`, {
      headers: { Cookie: sessionCookie },
    });

    expect(response.status).toBe(200);
  });
});
