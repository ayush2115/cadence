import type {
  Interval,
  SchedulerTask,
  Priority,
  SchedulerInput,
  SchedulerResult,
  PlanItem,
  OverflowItem,
} from "./types";

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

export const OVERFLOW_REASONS = {
  noSlot: "No free slot long enough today",
  depUnscheduled: "A task this depends on couldn't be scheduled",
  depCycle: "Part of a dependency cycle",
  deprioritized: "Deprioritized — not enough time for everything today",
} as const;

/** Consume [startMin, startMin+duration+buffer) from slots[index], splitting it. */
function consume(
  slots: Interval[],
  index: number,
  startMin: number,
  durationMin: number,
  bufferMin: number
): void {
  const s = slots[index];
  const consumedEnd = Math.min(startMin + durationMin + bufferMin, s.endMin);
  const remainders: Interval[] = [];
  if (startMin > s.startMin) remainders.push({ startMin: s.startMin, endMin: startMin });
  if (consumedEnd < s.endMin) remainders.push({ startMin: consumedEnd, endMin: s.endMin });
  slots.splice(index, 1, ...remainders);
}

/** First slot (chronological) where the task fits, respecting earliestStartMin. */
function placeFirstFit(
  slots: Interval[],
  durationMin: number,
  earliestStartMin: number,
  bufferMin: number
): { startMin: number } | null {
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const start = Math.max(s.startMin, earliestStartMin);
    if (start + durationMin <= s.endMin) {
      consume(slots, i, start, durationMin, bufferMin);
      return { startMin: start };
    }
  }
  return null;
}

export function schedule(input: SchedulerInput): SchedulerResult {
  const bufferMin = input.bufferMin ?? 0;
  const free = computeFreeIntervals(input.dayStartMin, input.dayEndMin, input.blocked);
  const freeMinutes = free.reduce((s, i) => s + (i.endMin - i.startMin), 0);
  const taskMinutes = input.tasks.reduce((s, t) => s + t.estimatedMinutes, 0);

  const slots: Interval[] = free.map((f) => ({ startMin: f.startMin, endMin: f.endMin }));
  const planned: PlanItem[] = [];
  const overflow: OverflowItem[] = [];

  for (const t of sortTasks(input.tasks)) {
    const placed = placeFirstFit(slots, t.estimatedMinutes, 0, bufferMin);
    if (!placed) {
      overflow.push({ taskId: t.id, reason: OVERFLOW_REASONS.noSlot });
      continue;
    }
    planned.push({
      taskId: t.id,
      startMin: placed.startMin,
      endMin: placed.startMin + t.estimatedMinutes,
      inFocus: false,
    });
  }

  planned.sort((a, b) => a.startMin - b.startMin);
  const plannedMinutes = planned.reduce((s, p) => s + (p.endMin - p.startMin), 0);
  return { planned, overflow, stats: { freeMinutes, plannedMinutes, taskMinutes } };
}
