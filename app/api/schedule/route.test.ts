import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/schedule/route";
import { OVERFLOW_REASONS } from "@/lib/scheduler";

const post = (body: unknown) =>
  POST(
    new Request("http://test/api/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("POST /api/schedule", () => {
  it("schedules tasks and maps times back to HH:MM", async () => {
    const res = await post({
      day: "2026-07-06",
      tasks: [
        { id: "t1", title: "Review PR", estimatedMinutes: 30, priority: "high",
          deadline: "2026-07-06", type: "coding" },
        { id: "t2", title: "DSA sheet", estimatedMinutes: 180, priority: "med",
          deadline: "2026-07-10", type: "study" },
      ],
      preferences: {
        workStart: "09:00", workEnd: "13:00",
        focusWindows: [{ start: "09:00", end: "11:00", label: "deep" }],
        blockedWindows: [{ start: "11:00", end: "11:30", label: "standup" }],
        bufferMinutes: 0,
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.planned).toEqual([
      { taskId: "t1", start: "09:00", end: "09:30", inFocus: true, locked: false },
    ]);
    expect(body.overflow).toEqual([
      { taskId: "t2", reason: OVERFLOW_REASONS.noSlot },
    ]);
    expect(body.stats).toEqual({ freeMinutes: 210, plannedMinutes: 30, taskMinutes: 210 });
  });

  it("rejects an invalid body with 400 and issues", async () => {
    const res = await post({ day: "not-a-day", tasks: [] });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("rejects workStart >= workEnd", async () => {
    const res = await post({
      day: "2026-07-06",
      tasks: [{ id: "t", title: "x", estimatedMinutes: 30 }],
      preferences: { workStart: "18:00", workEnd: "09:00" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects non-JSON bodies with 400", async () => {
    const res = await POST(
      new Request("http://test/api/schedule", { method: "POST", body: "not json" })
    );
    expect(res.status).toBe(400);
  });

  // preferences {} is fully valid (all fields default), so `day` is the only
  // variable — these tests isolate calendar-date validation.
  it("rejects an out-of-range calendar date (month 13, day 45) with 400", async () => {
    const res = await post({
      day: "2026-13-45",
      tasks: [{ id: "t", title: "x", estimatedMinutes: 30 }],
      preferences: {},
    });
    expect(res.status).toBe(400);
  });

  it("rejects a nonexistent calendar date (Feb 30) with 400", async () => {
    const res = await post({
      day: "2026-02-30",
      tasks: [{ id: "t", title: "x", estimatedMinutes: 30 }],
      preferences: {},
    });
    expect(res.status).toBe(400);
  });

  it("accepts a real calendar date with 200", async () => {
    const res = await post({
      day: "2026-07-06",
      tasks: [{ id: "t", title: "x", estimatedMinutes: 30 }],
      preferences: {},
    });
    expect(res.status).toBe(200);
  });
});
