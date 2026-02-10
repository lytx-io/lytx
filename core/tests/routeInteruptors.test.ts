import { describe, expect, test } from "bun:test";

import {
  checkIfTeamSetupSites,
  onlyAllowGetPost,
  onlyAllowPost,
} from "../src/utilities/route_interuptors";

describe("checkIfTeamSetupSites", () => {
  test("redirects when setup not complete", () => {
    const response = checkIfTeamSetupSites({
      ctx: { initial_site_setup: false, sites: [{ site_id: 1 }] },
    } as any);

    expect(response?.status).toBe(303);
    expect(response?.headers.get("location")).toBe("/new-site");
  });

  test("rejects when no sites assigned", () => {
    const response = checkIfTeamSetupSites({
      ctx: { initial_site_setup: true, sites: [] },
    } as any);

    expect(response?.status).toBe(403);
  });

  test("allows when sites present", () => {
    const response = checkIfTeamSetupSites({
      ctx: { initial_site_setup: true, sites: [{ site_id: 1 }] },
    } as any);

    expect(response).toBeUndefined();
  });
});

describe("onlyAllowGetPost", () => {
  test("allows GET", () => {
    const response = onlyAllowGetPost({
      request: new Request("https://example.com", { method: "GET" }),
    } as any);

    expect(response).toBeUndefined();
  });

  test("rejects DELETE", () => {
    const response = onlyAllowGetPost({
      request: new Request("https://example.com", { method: "DELETE" }),
    } as any);

    expect(response?.status).toBe(404);
  });
});

describe("onlyAllowPost", () => {
  test("allows POST", () => {
    const response = onlyAllowPost({
      request: new Request("https://example.com", { method: "POST" }),
    } as any);

    expect(response).toBeUndefined();
  });

  test("rejects GET", () => {
    const response = onlyAllowPost({
      request: new Request("https://example.com", { method: "GET" }),
    } as any);

    expect(response?.status).toBe(404);
  });
});
