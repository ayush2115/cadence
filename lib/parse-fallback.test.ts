import { describe, it, expect } from "vitest";
import { parseFallback } from "@/lib/parse-fallback";

// 2026-07-06 is a Monday.
const TODAY = "2026-07-06";

describe("parseFallback", () => {
  it("parses the canonical brain-dump", () => {
    const tasks = parseFallback(
      "Finish DSA graph sheet ~3h due Friday; review PR 30m today high priority; gym 1h; read system design 45m",
      TODAY
    );
    expect(tasks).toEqual([
      { title: "Finish DSA graph sheet", estimatedMinutes: 180, priority: "med",
        deadline: "2026-07-10", type: "study" },
      { title: "Review PR", estimatedMinutes: 30, priority: "high",
        deadline: "2026-07-06", type: "coding" },
      { title: "Gym", estimatedMinutes: 60, priority: "med",
        deadline: null, type: "personal" },
      { title: "Read system design", estimatedMinutes: 45, priority: "med",
        deadline: null, type: "study" },
    ]);
  });

  it("splits on newlines too and defaults duration to 60", () => {
    const tasks = parseFallback("buy groceries\nwrite blog post", TODAY);
    expect(tasks.map((t) => t.estimatedMinutes)).toEqual([60, 60]);
    expect(tasks.map((t) => t.title)).toEqual(["Buy groceries", "Write blog post"]);
  });

  it("parses combined hours+minutes and decimal hours", () => {
    const tasks = parseFallback("deep work 1h30m; quick fix 1.5h", TODAY);
    expect(tasks.map((t) => t.estimatedMinutes)).toEqual([90, 90]);
  });

  it("maps weekday deadlines to the next occurrence (today counts)", () => {
    const tasks = parseFallback("ship feature due monday; taxes by tomorrow", TODAY);
    expect(tasks[0].deadline).toBe("2026-07-06"); // today IS Monday
    expect(tasks[1].deadline).toBe("2026-07-07");
  });

  it("detects low priority phrasing", () => {
    const tasks = parseFallback("clean desk whenever 15m", TODAY);
    expect(tasks[0].priority).toBe("low");
  });

  it("returns empty array for blank input", () => {
    expect(parseFallback("   ", TODAY)).toEqual([]);
  });
});
