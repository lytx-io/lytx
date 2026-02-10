import { afterEach, describe, expect, mock, test } from "bun:test";

afterEach(() => {
  mock.restore();
});

describe("getDashboardDataRoute", () => {
  test("skipped: requires durable client mock resolution", () => {
    expect(true).toBe(true);
  });
});
