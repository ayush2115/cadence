import { describe, it, expect } from "vitest";
import { computeFreeIntervals, sortTasks } from "@/lib/scheduler";
import type { SchedulerTask } from "@/lib/types";

describe("computeFreeIntervals", () => {
  it("returns the whole work window when nothing is blocked", () => {
    expect(computeFreeIntervals(540, 1080, [])).toEqual([
      { startMin: 540, endMin: 1080 },
    ]);
  });

  it("splits the day around one blocked window", () => {
    expect(
      computeFreeIntervals(540, 1080, [{ startMin: 780, endMin: 840 }])
    ).toEqual([
      { startMin: 540, endMin: 780 },
      { startMin: 840, endMin: 1080 },
    ]);
  });

  it("merges overlapping blocks (interval partitioning)", () => {
    expect(
      computeFreeIntervals(540, 1080, [
        { startMin: 600, endMin: 700 },
        { startMin: 660, endMin: 760 },
      ])
    ).toEqual([
      { startMin: 540, endMin: 600 },
      { startMin: 760, endMin: 1080 },
    ]);
  });

  it("handles unsorted input and touching blocks", () => {
    expect(
      computeFreeIntervals(540, 1080, [
        { startMin: 700, endMin: 760 },
        { startMin: 600, endMin: 700 },
      ])
    ).toEqual([
      { startMin: 540, endMin: 600 },
      { startMin: 760, endMin: 1080 },
    ]);
  });

  it("clamps blocks that spill outside the work window", () => {
    expect(
      computeFreeIntervals(540, 1080, [
        { startMin: 0, endMin: 600 },
        { startMin: 1020, endMin: 2000 },
      ])
    ).toEqual([{ startMin: 600, endMin: 1020 }]);
  });

  it("ignores blocks entirely outside the window", () => {
    expect(
      computeFreeIntervals(540, 1080, [{ startMin: 0, endMin: 300 }])
    ).toEqual([{ startMin: 540, endMin: 1080 }]);
  });

  it("returns [] when blocks cover the whole day", () => {
    expect(
      computeFreeIntervals(540, 1080, [{ startMin: 500, endMin: 1100 }])
    ).toEqual([]);
  });
});

const task = (over: Partial<SchedulerTask> & { id: string }): SchedulerTask => ({
  estimatedMinutes: 60,
  priority: "med",
  deadlineOffsetMin: null,
  ...over,
});

describe("sortTasks (EDF with tie-breaks)", () => {
  it("orders by earliest deadline first", () => {
    const out = sortTasks([
      task({ id: "b", deadlineOffsetMin: 1020 }),
      task({ id: "a", deadlineOffsetMin: 720 }),
    ]);
    expect(out.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("puts tasks with no deadline last", () => {
    const out = sortTasks([
      task({ id: "none" }),
      task({ id: "due", deadlineOffsetMin: 1439 }),
    ]);
    expect(out.map((t) => t.id)).toEqual(["due", "none"]);
  });

  it("breaks deadline ties by priority (high > med > low)", () => {
    const out = sortTasks([
      task({ id: "l", priority: "low", deadlineOffsetMin: 720 }),
      task({ id: "h", priority: "high", deadlineOffsetMin: 720 }),
      task({ id: "m", priority: "med", deadlineOffsetMin: 720 }),
    ]);
    expect(out.map((t) => t.id)).toEqual(["h", "m", "l"]);
  });

  it("breaks full ties by longer duration first (big rocks)", () => {
    const out = sortTasks([
      task({ id: "short", estimatedMinutes: 30 }),
      task({ id: "long", estimatedMinutes: 120 }),
    ]);
    expect(out.map((t) => t.id)).toEqual(["long", "short"]);
  });

  it("is deterministic on total ties (by id) and does not mutate input", () => {
    const input = [task({ id: "z" }), task({ id: "a" })];
    const out = sortTasks(input);
    expect(out.map((t) => t.id)).toEqual(["a", "z"]);
    expect(input.map((t) => t.id)).toEqual(["z", "a"]);
  });
});
