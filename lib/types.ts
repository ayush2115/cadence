export type Priority = "low" | "med" | "high";

/** All engine times are integer minutes since 00:00 of the target day. */
export interface Interval {
  startMin: number;
  endMin: number;
  label?: string;
}

export interface SchedulerTask {
  id: string;
  estimatedMinutes: number;              // > 0
  priority: Priority;
  deadlineOffsetMin: number | null;      // null = no deadline
  dependsOn?: string[];                  // ids that must be scheduled before this
  type?: string | null;                  // matched against focus-window labels
}

/** An already-placed item that must stay fixed (re-planning). */
export interface LockedItem {
  taskId: string;
  startMin: number;
  endMin: number;
}

export interface SchedulerInput {
  dayStartMin: number;
  dayEndMin: number;
  blocked: Interval[];
  focus: Interval[];
  tasks: SchedulerTask[];
  bufferMin?: number;                    // gap between placed tasks, default 0
  locked?: LockedItem[];                 // kept fixed, carved out of free time
}

export interface PlanItem {
  taskId: string;
  startMin: number;
  endMin: number;
  inFocus: boolean;
  locked?: boolean;
}

export interface OverflowItem {
  taskId: string;
  reason: string;
}

export interface SchedulerStats {
  freeMinutes: number;      // available after blocked + locked carve-outs
  plannedMinutes: number;   // sum of newly placed durations (excl. locked, buffers)
  taskMinutes: number;      // sum of all input tasks' estimates
}

export interface SchedulerResult {
  planned: PlanItem[];
  overflow: OverflowItem[];
  stats: SchedulerStats;
}

/** Output of the parse layer (Gemini or fallback), consumed by the UI/API. */
export interface ParsedTask {
  title: string;
  estimatedMinutes: number;
  priority: Priority;
  deadline: string | null;  // ISO "YYYY-MM-DD" (or datetime) or null
  type: string | null;
}
