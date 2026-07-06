import type { Interval, SchedulerTask, Priority } from "./types";

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

const PRIORITY_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 };

/**
 * Earliest-Deadline-First: provably optimal for minimizing maximum lateness
 * on a single machine (one person). Ties: higher priority, then longer
 * duration ("big rocks first"), then id for determinism.
 */
export function compareTasks(a: SchedulerTask, b: SchedulerTask): number {
  const da = a.deadlineOffsetMin ?? Infinity;
  const db = b.deadlineOffsetMin ?? Infinity;
  if (da !== db) return da - db;
  const pa = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (pa !== 0) return pa;
  if (a.estimatedMinutes !== b.estimatedMinutes) {
    return b.estimatedMinutes - a.estimatedMinutes;
  }
  return a.id.localeCompare(b.id);
}

export function sortTasks(tasks: SchedulerTask[]): SchedulerTask[] {
  return [...tasks].sort(compareTasks);
}
