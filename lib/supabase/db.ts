import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type ClientTask,
  type PlannerPreferences,
  type Priority,
  DEFAULT_PREFERENCES,
} from "@/lib/planner";

// ── row <-> app-type mapping ─────────────────────────────────────────────

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  estimated_minutes: number;
  priority: string;
  deadline: string | null;
  type: string | null;
  status: string;
}

function taskToRow(t: ClientTask, userId: string): TaskRow {
  return {
    id: t.id,
    user_id: userId,
    title: t.title || "Untitled",
    estimated_minutes: t.estimatedMinutes,
    priority: t.priority,
    deadline: t.deadline, // "YYYY-MM-DD" parses to timestamptz; null stays null
    type: t.type,
    status: t.done ? "done" : "todo",
  };
}

function rowToTask(r: TaskRow): ClientTask {
  return {
    id: r.id,
    title: r.title,
    estimatedMinutes: r.estimated_minutes,
    priority: (["low", "med", "high"].includes(r.priority) ? r.priority : "med") as Priority,
    deadline: r.deadline ? r.deadline.slice(0, 10) : null,
    type: r.type,
    done: r.status === "done",
  };
}

function prefsToRow(p: PlannerPreferences, userId: string) {
  return {
    user_id: userId,
    work_start: p.workStart,
    work_end: p.workEnd,
    focus_windows: p.focusWindows,
    blocked_windows: p.blockedWindows,
    buffer_minutes: p.bufferMinutes,
    updated_at: new Date().toISOString(),
  };
}

function rowToPrefs(r: Record<string, unknown>): PlannerPreferences {
  return {
    workStart: (r.work_start as string)?.slice(0, 5) ?? DEFAULT_PREFERENCES.workStart,
    workEnd: (r.work_end as string)?.slice(0, 5) ?? DEFAULT_PREFERENCES.workEnd,
    focusWindows: (r.focus_windows as PlannerPreferences["focusWindows"]) ?? [],
    blockedWindows: (r.blocked_windows as PlannerPreferences["blockedWindows"]) ?? [],
    bufferMinutes: (r.buffer_minutes as number) ?? DEFAULT_PREFERENCES.bufferMinutes,
  };
}

// ── load / save ──────────────────────────────────────────────────────────

export async function loadPlannerData(
  supabase: SupabaseClient,
  userId: string
): Promise<{ tasks: ClientTask[]; preferences: PlannerPreferences }> {
  const [prefRes, taskRes] = await Promise.all([
    supabase.from("preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("tasks").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
  ]);
  return {
    preferences: prefRes.data ? rowToPrefs(prefRes.data) : DEFAULT_PREFERENCES,
    tasks: (taskRes.data ?? []).map((r) => rowToTask(r as TaskRow)),
  };
}

/** Replaces the user's stored task set with the current one (small lists, and
 *  RLS scopes every statement to this user). */
export async function saveTasks(
  supabase: SupabaseClient,
  userId: string,
  tasks: ClientTask[]
): Promise<void> {
  await supabase.from("tasks").delete().eq("user_id", userId);
  if (tasks.length > 0) {
    await supabase.from("tasks").insert(tasks.map((t) => taskToRow(t, userId)));
  }
}

export async function savePreferences(
  supabase: SupabaseClient,
  userId: string,
  preferences: PlannerPreferences
): Promise<void> {
  await supabase.from("preferences").upsert(prefsToRow(preferences, userId));
}
