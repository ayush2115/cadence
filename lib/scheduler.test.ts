import { describe, it, expect } from "vitest";
import { computeFreeIntervals } from "@/lib/scheduler";

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
