import { describe, it, expect } from "vitest";
import { safeNextPath } from "./safe-redirect";

const ORIGIN = "https://cadenceday.vercel.app";

describe("safeNextPath", () => {
  it("defaults to /plan when next is missing", () => {
    expect(safeNextPath(null, ORIGIN)).toBe("/plan");
  });

  it("keeps same-site paths, including query and hash", () => {
    expect(safeNextPath("/plan?day=2026-07-06#top", ORIGIN)).toBe("/plan?day=2026-07-06#top");
  });

  it.each([
    ["@evil.com"], // `${origin}@evil.com` would make evil.com the host
    ["//evil.com"],
    ["/\\evil.com"],
    ["https://evil.com/plan"],
    ["javascript:alert(1)"],
  ])("never leaves the site for %s", (next) => {
    const result = safeNextPath(next, ORIGIN);
    expect(new URL(`${ORIGIN}${result}`).origin).toBe(ORIGIN);
  });
});
