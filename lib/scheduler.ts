import type { Interval } from "./types";

/**
 * Free time = [dayStart, dayEnd) minus blocked windows.
 * Blocks are clamped to the day, sorted, and merged (interval partitioning)
 * before subtraction, so overlapping/unsorted input is handled correctly.
 */
export function computeFreeIntervals(
  dayStartMin: number,
  dayEndMin: number,
  blocked: Interval[]
): Interval[] {
  const clamped = blocked
    .map((b) => ({
      startMin: Math.max(b.startMin, dayStartMin),
      endMin: Math.min(b.endMin, dayEndMin),
    }))
    .filter((b) => b.startMin < b.endMin)
    .sort((a, b) => a.startMin - b.startMin);

  const merged: Interval[] = [];
  for (const b of clamped) {
    const last = merged[merged.length - 1];
    if (last && b.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, b.endMin);
    } else {
      merged.push({ ...b });
    }
  }

  const free: Interval[] = [];
  let cursor = dayStartMin;
  for (const b of merged) {
    if (b.startMin > cursor) free.push({ startMin: cursor, endMin: b.startMin });
    cursor = Math.max(cursor, b.endMin);
  }
  if (cursor < dayEndMin) free.push({ startMin: cursor, endMin: dayEndMin });
  return free;
}
