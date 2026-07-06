import { describe, it, expect } from "vitest";
import {
  computeFreeIntervals,
  sortTasks,
  schedule,
  OVERFLOW_REASONS,
} from "@/lib/scheduler";
import type { SchedulerTask, SchedulerInput } from "@/lib/types";

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

const baseInput = (over: Partial<SchedulerInput> = {}): SchedulerInput => ({
  dayStartMin: 540, // 09:00
  dayEndMin: 1080, // 18:00
  blocked: [],
  focus: [],
  tasks: [],
  ...over,
});

describe("schedule — core first-fit", () => {
  it("places a single task at the start of the day", () => {
    const r = schedule(baseInput({ tasks: [task({ id: "a", estimatedMinutes: 90 })] }));
    expect(r.planned).toEqual([
      { taskId: "a", startMin: 540, endMin: 630, inFocus: false },
    ]);
    expect(r.overflow).toEqual([]);
  });

  it("places tasks back-to-back in EDF order regardless of input order", () => {
    const r = schedule(
      baseInput({
        tasks: [
          task({ id: "later", estimatedMinutes: 60, deadlineOffsetMin: 1080 }),
          task({ id: "urgent", estimatedMinutes: 60, deadlineOffsetMin: 720 }),
        ],
      })
    );
    expect(r.planned).toEqual([
      { taskId: "urgent", startMin: 540, endMin: 600, inFocus: false },
      { taskId: "later", startMin: 600, endMin: 660, inFocus: false },
    ]);
  });

  it("skips a gap that is too small (first-fit into the next interval)", () => {
    // free: 540-600 (60m), then 660-900
    const r = schedule(
      baseInput({
        dayEndMin: 900,
        blocked: [{ startMin: 600, endMin: 660 }],
        tasks: [task({ id: "big", estimatedMinutes: 90 })],
      })
    );
    expect(r.planned).toEqual([
      { taskId: "big", startMin: 660, endMin: 750, inFocus: false },
    ]);
  });

  it("reports honest overflow when a task fits nowhere", () => {
    const r = schedule(
      baseInput({
        dayEndMin: 660, // 2h day
        tasks: [
          task({ id: "fits", estimatedMinutes: 60, priority: "high" }),
          task({ id: "toobig", estimatedMinutes: 90 }),
        ],
      })
    );
    expect(r.planned.map((p) => p.taskId)).toEqual(["fits"]);
    expect(r.overflow).toEqual([
      { taskId: "toobig", reason: OVERFLOW_REASONS.noSlot },
    ]);
  });

  it("computes reality-check stats", () => {
    const r = schedule(
      baseInput({
        dayEndMin: 780, // 4h day
        blocked: [{ startMin: 600, endMin: 660 }], // 1h blocked -> 3h free
        tasks: [
          task({ id: "a", estimatedMinutes: 60 }),
          task({ id: "b", estimatedMinutes: 240 }), // overflows
        ],
      })
    );
    expect(r.stats).toEqual({ freeMinutes: 180, plannedMinutes: 60, taskMinutes: 300 });
  });

  it("returns planned items sorted by start time", () => {
    const r = schedule(
      baseInput({
        tasks: [
          task({ id: "b", estimatedMinutes: 30 }),
          task({ id: "a", estimatedMinutes: 30, deadlineOffsetMin: 600 }),
        ],
      })
    );
    const starts = r.planned.map((p) => p.startMin);
    expect(starts).toEqual([...starts].sort((x, y) => x - y));
  });

  it("handles the empty-tasks case", () => {
    const r = schedule(baseInput());
    expect(r).toEqual({
      planned: [],
      overflow: [],
      stats: { freeMinutes: 540, plannedMinutes: 0, taskMinutes: 0 },
    });
  });
});
