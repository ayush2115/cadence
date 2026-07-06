// Client-side model + API helpers for the planner UI. The server owns the
// scheduling math (lib/scheduler.ts via /api/schedule); this only shapes state
// and talks to the two routes.

export type Priority = "low" | "med" | "high";

export interface ClientTask {
  id: string;
  title: string;
  estimatedMinutes: number;
  priority: Priority;
  deadline: string | null; // ISO date or null
  type: string | null;
  done: boolean;
}

export interface TimeWindow {
  start: string; // "HH:MM"
  end: string;
  label?: string;
}

export interface PlannerPreferences {
  workStart: string;
  workEnd: string;
  focusWindows: TimeWindow[];
  blockedWindows: TimeWindow[];
  bufferMinutes: number;
}

export interface PlanItemView {
  taskId: string;
  start: string;
  end: string;
  inFocus: boolean;
  locked: boolean;
}

export interface ScheduleResult {
  planned: PlanItemView[];
  overflow: { taskId: string; reason: string }[];
  stats: { freeMinutes: number; plannedMinutes: number; taskMinutes: number };
}

export interface ParseResult {
  tasks: Omit<ClientTask, "id" | "done">[];
  source: "gemini" | "fallback";
}

export const DEFAULT_PREFERENCES: PlannerPreferences = {
  workStart: "09:00",
  workEnd: "18:00",
  focusWindows: [{ start: "09:00", end: "11:00", label: "deep" }],
  blockedWindows: [{ start: "13:00", end: "14:00", label: "lunch" }],
  bufferMinutes: 5,
};

export const EXAMPLE_DUMP =
  "Finish DSA graph sheet ~3h due Friday; review PR 30m today high priority; gym 1h; read system design 45m; reply to recruiter emails 20m";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t_${Math.floor(Date.now() % 1e9)}_${Math.floor(performance.now())}`;
}

/** "1h 30m" · "45m" · "2h" */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** "5h 30m" reality-check phrasing */
export function formatHoursLoose(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  med: "Medium",
  low: "Low",
};

export const PRIORITY_ORDER: Priority[] = ["high", "med", "low"];

export function relativeDeadline(deadline: string | null, day: string): string | null {
  if (!deadline) return null;
  const d = new Date(`${deadline}T00:00:00`);
  const base = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.round((d.getTime() - base.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7)
    return d.toLocaleDateString(undefined, { weekday: "long" }).toLowerCase();
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export async function parseDump(text: string, today: string): Promise<ParseResult> {
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, today }),
  });
  if (!res.ok) throw new Error("Couldn't read those tasks — try rephrasing.");
  return res.json();
}

export async function scheduleDay(
  tasks: ClientTask[],
  preferences: PlannerPreferences,
  day: string
): Promise<ScheduleResult> {
  const res = await fetch("/api/schedule", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      day,
      tasks: tasks
        .filter((t) => !t.done)
        .map((t) => ({
          id: t.id,
          title: t.title,
          estimatedMinutes: t.estimatedMinutes,
          priority: t.priority,
          deadline: t.deadline,
          type: t.type,
        })),
      preferences,
    }),
  });
  if (!res.ok) throw new Error("Couldn't build a plan from those settings.");
  return res.json();
}
