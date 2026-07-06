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

/**
 * A task prefers a focus window if any focus window exists and it is either
 * high-priority or its `type` matches a focus-window label (case-insensitive).
 */
function isFocusPreferred(t: SchedulerTask, focus: Interval[]): boolean {
  if (focus.length === 0) return false;
  if (t.priority === "high") return true;
  const ty = t.type?.toLowerCase();
  return !!ty && focus.some((f) => f.label?.toLowerCase() === ty);
}

/** Earliest placement fully inside a focus window; consumes from the real slot. */
function placeInFocus(
  slots: Interval[],
  focus: Interval[],
  durationMin: number,
  earliestStartMin: number,
  bufferMin: number
): { startMin: number } | null {
  let best: { index: number; startMin: number } | null = null;
  for (let i = 0; i < slots.length; i++) {
    for (const f of focus) {
      const start = Math.max(slots[i].startMin, f.startMin, earliestStartMin);
      const end = Math.min(slots[i].endMin, f.endMin);
      if (start + durationMin <= end && (!best || start < best.startMin)) {
        best = { index: i, startMin: start };
      }
    }
  }
  if (!best) return null;
  consume(slots, best.index, best.startMin, durationMin, bufferMin);
  return { startMin: best.startMin };
}

/** True when [startMin, endMin) sits fully inside some focus window. */
function isWithinFocus(startMin: number, endMin: number, focus: Interval[]): boolean {
  return focus.some((f) => startMin >= f.startMin && endMin <= f.endMin);
}

/**
 * Kahn's algorithm with an EDF-ordered ready set: among tasks whose
 * prerequisites are satisfied, always pick the EDF-best next. Tasks left
 * unprocessed are part of a cycle.
 */
function topoOrder(tasks: SchedulerTask[]): { order: SchedulerTask[]; cyclic: SchedulerTask[] } {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const t of tasks) {
    const deps = (t.dependsOn ?? []).filter((d) => byId.has(d) && d !== t.id);
    indegree.set(t.id, deps.length);
    for (const d of deps) dependents.set(d, [...(dependents.get(d) ?? []), t.id]);
  }
  const ready = tasks.filter((t) => indegree.get(t.id) === 0);
  const order: SchedulerTask[] = [];
  while (ready.length > 0) {
    ready.sort(compareTasks);
    const next = ready.shift()!;
    order.push(next);
    for (const depId of dependents.get(next.id) ?? []) {
      const left = indegree.get(depId)! - 1;
      indegree.set(depId, left);
      if (left === 0) ready.push(byId.get(depId)!);
    }
  }
  const placedIds = new Set(order.map((t) => t.id));
  return { order, cyclic: tasks.filter((t) => !placedIds.has(t.id)) };
}

export function schedule(input: SchedulerInput): SchedulerResult {
  const bufferMin = input.bufferMin ?? 0;
  const lockedItems = input.locked ?? [];
  const free = computeFreeIntervals(input.dayStartMin, input.dayEndMin, [
    ...input.blocked,
    ...lockedItems.map((l) => ({ startMin: l.startMin, endMin: l.endMin })),
  ]);
  const freeMinutes = free.reduce((s, i) => s + (i.endMin - i.startMin), 0);
  const taskMinutes = input.tasks.reduce((s, t) => s + t.estimatedMinutes, 0);

  const slots: Interval[] = free.map((f) => ({ startMin: f.startMin, endMin: f.endMin }));
  const planned: PlanItem[] = [];
  const overflow: OverflowItem[] = [];

  // When the day can't hold everything, keep the highest-value subset that
  // fits (0/1 knapsack over free minutes) and deprioritize the rest — plus
  // the dependency closure of anything dropped.
  let candidates = input.tasks;
  if (taskMinutes > freeMinutes) {
    const sel = selectByValue(input.tasks, freeMinutes, input.dayEndMin);
    candidates = sel.keep;
    const droppedIds = new Set(sel.drop.map((t) => t.id));
    // closure: dropping a task drops everything that depends on it
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of candidates) {
        if ((t.dependsOn ?? []).some((d) => droppedIds.has(d))) {
          droppedIds.add(t.id);
          candidates = candidates.filter((c) => c.id !== t.id);
          changed = true;
        }
      }
    }
    for (const t of input.tasks) {
      if (droppedIds.has(t.id)) {
        overflow.push({ taskId: t.id, reason: OVERFLOW_REASONS.deprioritized });
      }
    }
  }

  const { order, cyclic } = topoOrder(candidates);
  const endOf = new Map<string, number>();      // taskId -> placed end
  const failed = new Set<string>();             // overflowed task ids
  const inBatch = new Set(candidates.map((t) => t.id));

  // Locked items are already placed: seed their end times (so dependents can
  // start after them) and emit them into the plan as fixed, flagged entries.
  for (const l of lockedItems) {
    endOf.set(l.taskId, l.endMin);
    planned.push({
      taskId: l.taskId,
      startMin: l.startMin,
      endMin: l.endMin,
      inFocus: isWithinFocus(l.startMin, l.endMin, input.focus),
      locked: true,
    });
  }
  for (const t of cyclic) {
    overflow.push({ taskId: t.id, reason: OVERFLOW_REASONS.depCycle });
    failed.add(t.id); // cascade cyclic failure to any dependents
  }

  for (const t of order) {
    const deps = (t.dependsOn ?? []).filter((d) => (inBatch.has(d) || endOf.has(d)) && d !== t.id);
    if (deps.some((d) => failed.has(d))) {
      overflow.push({ taskId: t.id, reason: OVERFLOW_REASONS.depUnscheduled });
      failed.add(t.id);
      continue;
    }
    const earliest = Math.max(0, ...deps.map((d) => endOf.get(d) ?? 0));

    let placed: { startMin: number } | null = null;
    if (isFocusPreferred(t, input.focus)) {
      placed = placeInFocus(slots, input.focus, t.estimatedMinutes, earliest, bufferMin);
    }
    placed ??= placeFirstFit(slots, t.estimatedMinutes, earliest, bufferMin);
    if (!placed) {
      overflow.push({ taskId: t.id, reason: OVERFLOW_REASONS.noSlot });
      failed.add(t.id);
      continue;
    }
    const endMin = placed.startMin + t.estimatedMinutes;
    endOf.set(t.id, endMin);
    planned.push({
      taskId: t.id,
      startMin: placed.startMin,
      endMin,
      inFocus: isWithinFocus(placed.startMin, endMin, input.focus),
    });
  }

  planned.sort((a, b) => a.startMin - b.startMin);
  const plannedMinutes = planned.reduce((s, p) => s + (p.locked ? 0 : p.endMin - p.startMin), 0);
  return { planned, overflow, stats: { freeMinutes, plannedMinutes, taskMinutes } };
}

const PRIORITY_VALUE: Record<Priority, number> = { high: 4, med: 2, low: 1 };

/**
 * A task's value = priority weight × minutes of important work, doubled when
 * it is due within the day being planned ("priority-weighted urgent minutes").
 */
export function taskValue(t: SchedulerTask, dayEndMin: number): number {
  const dueToday = t.deadlineOffsetMin !== null && t.deadlineOffsetMin <= dayEndMin ? 2 : 1;
  return PRIORITY_VALUE[t.priority] * dueToday * t.estimatedMinutes;
}

/**
 * 0/1 knapsack over free minutes (exact DP; capacity ≤ 1440 keeps it cheap):
 * choose the subset of tasks with maximum total value that fits the
 * available time. Deciding what to KEEP when overcommitted is the honest
 * core of the product.
 */
export function selectByValue(
  tasks: SchedulerTask[],
  capacityMin: number,
  dayEndMin: number
): { keep: SchedulerTask[]; drop: SchedulerTask[] } {
  const n = tasks.length;
  const W = Math.max(0, Math.floor(capacityMin));
  const dp = new Float64Array(W + 1);
  const take: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    const w = tasks[i].estimatedMinutes;
    const v = taskValue(tasks[i], dayEndMin);
    const row = new Uint8Array(W + 1);
    for (let cap = W; cap >= w; cap--) {
      const cand = dp[cap - w] + v;
      if (cand > dp[cap]) {
        dp[cap] = cand;
        row[cap] = 1;
      }
    }
    take.push(row);
  }
  const keep: SchedulerTask[] = [];
  const drop: SchedulerTask[] = [];
  let cap = W;
  for (let i = n - 1; i >= 0; i--) {
    if (take[i][cap]) {
      keep.push(tasks[i]);
      cap -= tasks[i].estimatedMinutes;
    } else {
      drop.push(tasks[i]);
    }
  }
  keep.reverse();
  drop.reverse();
  return { keep, drop };
}
