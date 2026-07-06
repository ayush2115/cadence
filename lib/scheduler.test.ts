import { describe, it, expect } from "vitest";
import {
  computeFreeIntervals,
  sortTasks,
  schedule,
  selectByValue,
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

  it("places what fits and reports noSlot for a task that fits no single contiguous gap", () => {
    // free: three 60-min gaps (540-600, 660-720, 780-840) = 180 free total.
    // taskMinutes 150 <= 180 => NOT overcommitted (selection stays off),
    // but the 90m task fits no single 60-min gap => noSlot (fragmentation).
    const r = schedule(
      baseInput({
        dayEndMin: 840,
        blocked: [
          { startMin: 600, endMin: 660 },
          { startMin: 720, endMin: 780 },
        ],
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

describe("schedule — buffers", () => {
  it("leaves bufferMin between consecutive tasks", () => {
    const r = schedule(
      baseInput({
        bufferMin: 10,
        tasks: [
          task({ id: "a", estimatedMinutes: 60, deadlineOffsetMin: 700 }),
          task({ id: "b", estimatedMinutes: 60, deadlineOffsetMin: 900 }),
        ],
      })
    );
    expect(r.planned).toEqual([
      { taskId: "a", startMin: 540, endMin: 600, inFocus: false },
      { taskId: "b", startMin: 610, endMin: 670, inFocus: false },
    ]);
  });

  it("does not require a buffer after the last task at the end of a slot", () => {
    // 60-minute day, 60-minute task, buffer 10: task still fits.
    const r = schedule(
      baseInput({
        dayEndMin: 600,
        bufferMin: 10,
        tasks: [task({ id: "a", estimatedMinutes: 60 })],
      })
    );
    expect(r.planned).toEqual([
      { taskId: "a", startMin: 540, endMin: 600, inFocus: false },
    ]);
    expect(r.overflow).toEqual([]);
  });
});

describe("schedule — focus windows", () => {
  const focusDay = (tasks: SchedulerTask[]) =>
    baseInput({ focus: [{ startMin: 780, endMin: 1020, label: "deep" }], tasks });

  it("pulls a high-priority task into the focus window even when earlier slots exist", () => {
    const r = schedule(
      focusDay([
        task({ id: "deep-work", priority: "high", estimatedMinutes: 120 }),
        task({ id: "email", priority: "low", estimatedMinutes: 60 }),
      ])
    );
    const deep = r.planned.find((p) => p.taskId === "deep-work")!;
    const email = r.planned.find((p) => p.taskId === "email")!;
    expect(deep.startMin).toBe(780);
    expect(deep.inFocus).toBe(true);
    expect(email.startMin).toBe(540);
    expect(email.inFocus).toBe(false);
  });

  it("pulls a type-matching task into the labelled focus window", () => {
    const r = schedule(
      baseInput({
        focus: [{ startMin: 780, endMin: 900, label: "study" }],
        tasks: [task({ id: "dsa", type: "study", estimatedMinutes: 60 })],
      })
    );
    expect(r.planned[0]).toEqual({
      taskId: "dsa", startMin: 780, endMin: 840, inFocus: true,
    });
  });

  it("falls back to plain first-fit when the focus window is too small", () => {
    const r = schedule(
      baseInput({
        focus: [{ startMin: 780, endMin: 840, label: "deep" }], // only 60m
        tasks: [task({ id: "big", priority: "high", estimatedMinutes: 120 })],
      })
    );
    expect(r.planned[0].startMin).toBe(540);
    expect(r.planned[0].inFocus).toBe(false);
  });

  it("marks inFocus for any task that happens to land fully inside focus", () => {
    const r = schedule(
      baseInput({
        focus: [{ startMin: 540, endMin: 720, label: "deep" }],
        tasks: [task({ id: "normal", priority: "med", estimatedMinutes: 60 })],
      })
    );
    expect(r.planned[0].inFocus).toBe(true);
  });
});

describe("schedule — dependencies", () => {
  it("schedules a prerequisite before its dependent in time", () => {
    const r = schedule(
      baseInput({
        tasks: [
          // dependent has the EARLIER deadline — without deps it would go first
          task({ id: "write-tests", estimatedMinutes: 60, deadlineOffsetMin: 700, dependsOn: ["write-code"] }),
          task({ id: "write-code", estimatedMinutes: 120, deadlineOffsetMin: 1000 }),
        ],
      })
    );
    const code = r.planned.find((p) => p.taskId === "write-code")!;
    const tests = r.planned.find((p) => p.taskId === "write-tests")!;
    expect(tests.startMin).toBeGreaterThanOrEqual(code.endMin);
  });

  it("cascades overflow: a dependent of a task that fits no gap overflows too", () => {
    // free: three 60-min gaps = 180 total; taskMinutes 120 <= 180 (not overcommitted).
    // huge(90) fits no single 60-min gap -> noSlot; child depends on huge -> depUnscheduled.
    const r = schedule(
      baseInput({
        dayEndMin: 840,
        blocked: [
          { startMin: 600, endMin: 660 },
          { startMin: 720, endMin: 780 },
        ],
        tasks: [
          task({ id: "huge", estimatedMinutes: 90 }),
          task({ id: "child", estimatedMinutes: 30, dependsOn: ["huge"] }),
        ],
      })
    );
    expect(r.overflow).toEqual([
      { taskId: "huge", reason: OVERFLOW_REASONS.noSlot },
      { taskId: "child", reason: OVERFLOW_REASONS.depUnscheduled },
    ]);
  });

  it("sends dependency cycles to overflow, schedules the rest", () => {
    const r = schedule(
      baseInput({
        tasks: [
          task({ id: "x", dependsOn: ["y"] }),
          task({ id: "y", dependsOn: ["x"] }),
          task({ id: "free-agent" }),
        ],
      })
    );
    expect(r.planned.map((p) => p.taskId)).toEqual(["free-agent"]);
    expect(r.overflow).toEqual(
      expect.arrayContaining([
        { taskId: "x", reason: OVERFLOW_REASONS.depCycle },
        { taskId: "y", reason: OVERFLOW_REASONS.depCycle },
      ])
    );
  });

  it("ignores dependsOn ids that are not in the batch (already done elsewhere)", () => {
    const r = schedule(
      baseInput({ tasks: [task({ id: "solo", dependsOn: ["not-here"] })] })
    );
    expect(r.planned.map((p) => p.taskId)).toEqual(["solo"]);
    expect(r.overflow).toEqual([]);
  });
});

describe("schedule — value-max selection when overcommitted", () => {
  it("keeps the highest-value tasks and reports the rest as deprioritized", () => {
    // 9h day = 540 free minutes; 12h of tasks.
    const r = schedule(
      baseInput({
        tasks: [
          task({ id: "high", priority: "high", estimatedMinutes: 240 }), // value 960
          task({ id: "med", priority: "med", estimatedMinutes: 240 }),   // value 480
          task({ id: "low", priority: "low", estimatedMinutes: 240 }),   // value 240
        ],
      })
    );
    expect(r.planned.map((p) => p.taskId).sort()).toEqual(["high", "med"]);
    expect(r.overflow).toEqual([
      { taskId: "low", reason: OVERFLOW_REASONS.deprioritized },
    ]);
  });

  it("favors a task due today over an equal task without a deadline", () => {
    // 4h day (540-780): capacity 240, two 240m low tasks.
    const r = schedule(
      baseInput({
        dayEndMin: 780,
        tasks: [
          task({ id: "no-deadline", priority: "low", estimatedMinutes: 240 }),
          task({ id: "due-today", priority: "low", estimatedMinutes: 240, deadlineOffsetMin: 770 }),
        ],
      })
    );
    expect(r.planned.map((p) => p.taskId)).toEqual(["due-today"]);
    expect(r.overflow).toEqual([
      { taskId: "no-deadline", reason: OVERFLOW_REASONS.deprioritized },
    ]);
  });

  it("drops dependents of dropped tasks (closure)", () => {
    const r = schedule(
      baseInput({
        dayEndMin: 780, // capacity 240
        tasks: [
          task({ id: "keeper", priority: "high", estimatedMinutes: 240 }),
          task({ id: "loser", priority: "low", estimatedMinutes: 120 }),
          task({ id: "loser-child", priority: "high", estimatedMinutes: 30, dependsOn: ["loser"] }),
        ],
      })
    );
    expect(r.planned.map((p) => p.taskId)).toEqual(["keeper"]);
    expect(r.overflow).toEqual(
      expect.arrayContaining([
        { taskId: "loser", reason: OVERFLOW_REASONS.deprioritized },
        { taskId: "loser-child", reason: OVERFLOW_REASONS.deprioritized },
      ])
    );
  });

  it("drops a knapsack-surviving child only through the dependency closure", () => {
    // capacity 120: parent (low, value 120) and child (high, value 480) each
    // need the full 120m, so only one can be kept. The knapsack keeps the
    // higher-value CHILD and drops the parent — the child survives the knapsack
    // on its own value. The closure loop then removes the child because its
    // parent was dropped, so both end up deprioritized.
    const r = schedule(
      baseInput({
        dayEndMin: 660, // free = 120
        tasks: [
          task({ id: "parent", priority: "low", estimatedMinutes: 120 }),
          task({ id: "child", priority: "high", estimatedMinutes: 120, dependsOn: ["parent"] }),
        ],
      })
    );
    expect(r.planned).toEqual([]);
    expect(r.overflow).toEqual(
      expect.arrayContaining([
        { taskId: "parent", reason: OVERFLOW_REASONS.deprioritized },
        { taskId: "child", reason: OVERFLOW_REASONS.deprioritized },
      ])
    );
  });

  it("does not run selection when everything fits", () => {
    const r = schedule(
      baseInput({
        tasks: [
          task({ id: "a", estimatedMinutes: 60 }),
          task({ id: "b", estimatedMinutes: 60 }),
        ],
      })
    );
    expect(r.overflow).toEqual([]);
  });
});

describe("schedule — re-planning with locked items", () => {
  it("keeps locked items fixed and packs new tasks around them", () => {
    const r = schedule(
      baseInput({
        dayEndMin: 780,
        locked: [{ taskId: "done-standup", startMin: 600, endMin: 660 }],
        tasks: [task({ id: "next", estimatedMinutes: 120 })],
      })
    );
    expect(r.planned).toEqual([
      { taskId: "done-standup", startMin: 600, endMin: 660, inFocus: false, locked: true },
      { taskId: "next", startMin: 660, endMin: 780, inFocus: false },
    ]);
    expect(r.stats.freeMinutes).toBe(180); // 240 - 60 locked
  });

  it("excludes locked items from plannedMinutes (they are already placed, not new work)", () => {
    const r = schedule(
      baseInput({
        dayEndMin: 780,
        locked: [{ taskId: "done-standup", startMin: 600, endMin: 660 }],
        tasks: [task({ id: "next", estimatedMinutes: 120 })],
      })
    );
    // freeMinutes 180 (240 - 60 locked); plannedMinutes counts only "next" (120), NOT the 60 locked.
    expect(r.stats.freeMinutes).toBe(180);
    expect(r.stats.plannedMinutes).toBe(120);
  });

  it("starts a task after the locked prerequisite it depends on", () => {
    const r = schedule(
      baseInput({
        locked: [{ taskId: "morning-review", startMin: 600, endMin: 660 }],
        tasks: [task({ id: "followup", estimatedMinutes: 30, dependsOn: ["morning-review"] })],
      })
    );
    const f = r.planned.find((p) => p.taskId === "followup")!;
    expect(f.startMin).toBeGreaterThanOrEqual(660);
  });

  it("does not double-place a task id that is also locked", () => {
    // "dup" is both a locked (already-placed) item and an incoming task.
    // The locked entry wins; the task must not be scheduled again.
    const r = schedule(
      baseInput({
        dayEndMin: 780,
        locked: [{ taskId: "dup", startMin: 600, endMin: 660 }],
        tasks: [task({ id: "dup", estimatedMinutes: 120 })],
      })
    );
    const dupItems = r.planned.filter((p) => p.taskId === "dup");
    expect(dupItems).toHaveLength(1);
    expect(dupItems[0].locked).toBe(true);
    // its 120 minutes must not double-count as new planned work
    expect(r.stats.plannedMinutes).toBe(0);
  });
});

describe("selectByValue (knapsack DP)", () => {
  it("finds the optimal subset, not the greedy one", () => {
    // capacity 300: greedy-by-value takes A(200min,v=800h?) — construct a case
    // where two smaller tasks beat one big one:
    const a = task({ id: "a", priority: "high", estimatedMinutes: 300 }); // value 1200
    const b = task({ id: "b", priority: "high", estimatedMinutes: 150 }); // value 600
    const c = task({ id: "c", priority: "high", estimatedMinutes: 150 }); // value 600
    const d = task({ id: "d", priority: "med", estimatedMinutes: 150 });  // value 300
    // capacity 450: best = a+b (1800) or a+c; NOT b+c+d (1500)
    const { keep } = selectByValue([a, b, c, d], 450, 1080);
    const kept = keep.map((t) => t.id);
    expect(kept).toContain("a");
    expect(kept.length).toBe(2);
    expect(kept.filter((id) => ["b", "c"].includes(id)).length).toBe(1);
  });

  it("beats a value-DENSITY greedy, not just a weight-ascending one", () => {
    // density = value/weight = PRIORITY_VALUE * dueMultiplier (minutes cancel).
    //   A: high, no deadline -> density 4;  B,C: med, no deadline -> density 2.
    // Values (taskValue = PRIORITY_VALUE * due * minutes, weight = minutes):
    //   A: 4*1*30 = 120 (w30)   B: 2*1*90 = 180 (w90)   C: 180 (w90)
    // Capacity 180. Density-greedy takes A (highest density) then B, leaving 60
    // -> can't fit C -> {A,B}=300. The exact DP takes {B,C}=360.
    const a = task({ id: "a", priority: "high", estimatedMinutes: 30 });
    const b = task({ id: "b", priority: "med", estimatedMinutes: 90 });
    const c = task({ id: "c", priority: "med", estimatedMinutes: 90 });
    const { keep, drop } = selectByValue([a, b, c], 180, 1080);
    expect(keep.map((t) => t.id).sort()).toEqual(["b", "c"]);
    expect(drop.map((t) => t.id)).toEqual(["a"]);
  });
});
