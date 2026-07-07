"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  type ClientTask,
  type PlannerPreferences,
  type ScheduleResult,
  DEFAULT_PREFERENCES,
  EXAMPLE_DUMP,
  formatDuration,
  formatHoursLoose,
  newId,
  parseDump,
  scheduleDay,
  todayISO,
} from "@/lib/planner";
import { Button, Dot, priorityColor } from "@/components/ui";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { loadPlannerData, saveTasks, savePreferences } from "@/lib/supabase/db";
import { TaskCard } from "./TaskCard";
import { Preferences } from "./Preferences";
import { Timeline } from "./Timeline";

export function PlannerApp() {
  const [text, setText] = useState("");
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [prefs, setPrefs] = useState<PlannerPreferences>(DEFAULT_PREFERENCES);
  const [plan, setPlan] = useState<ScheduleResult | null>(null);
  const [busy, setBusy] = useState<"idle" | "parsing" | "planning">("idle");
  const [source, setSource] = useState<"gemini" | "fallback" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const day = todayISO();

  const supabase = useMemo(() => (supabaseConfigured ? createClient() : null), []);
  const [userId, setUserId] = useState<string | null>(null);
  const hydrating = useRef(false);

  const runSchedule = useCallback(
    async (nextTasks: ClientTask[], nextPrefs: PlannerPreferences) => {
      const active = nextTasks.filter((t) => !t.done);
      if (active.length === 0) {
        setPlan(null);
        return;
      }
      try {
        setBusy("planning");
        setError(null);
        setPlan(await scheduleDay(nextTasks, nextPrefs, day));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy("idle");
      }
    },
    [day]
  );

  async function planMyDay() {
    if (!text.trim()) return;
    try {
      setBusy("parsing");
      setError(null);
      const { tasks: parsed, source: src } = await parseDump(text, day);
      const withIds: ClientTask[] = parsed.map((t) => ({ ...t, id: newId(), done: false }));
      setSource(src);
      setTasks(withIds);
      await runSchedule(withIds, prefs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read those tasks.");
      setBusy("idle");
    }
  }

  // Live re-plan when tasks or prefs change (after the first plan exists).
  const planKey = JSON.stringify({ tasks, prefs });
  const first = useRef(true);
  useEffect(() => {
    if (tasks.length === 0) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => runSchedule(tasks, prefs), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey]);

  // Load the signed-in user's saved tasks + preferences on mount.
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user || cancelled) return;
      hydrating.current = true;
      setUserId(user.id);
      const loaded = await loadPlannerData(supabase, user.id);
      if (cancelled) return;
      setPrefs(loaded.preferences);
      if (loaded.tasks.length > 0) {
        setTasks(loaded.tasks);
        await runSchedule(loaded.tasks, loaded.preferences);
      }
      hydrating.current = false;
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, runSchedule]);

  // Persist tasks + preferences (debounced) whenever they change while signed in.
  useEffect(() => {
    if (!supabase || !userId || hydrating.current) return;
    const id = setTimeout(() => {
      saveTasks(supabase, userId, tasks);
      savePreferences(supabase, userId, prefs);
    }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey, supabase, userId]);

  const patchTask = (id: string, patch: Partial<ClientTask>) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const removeTask = (id: string) => setTasks((ts) => ts.filter((t) => t.id !== id));
  const addTask = () =>
    setTasks((ts) => [
      ...ts,
      { id: newId(), title: "", estimatedMinutes: 30, priority: "med", deadline: null, type: null, done: false },
    ]);

  const hasPlan = plan !== null && tasks.some((t) => !t.done);
  const stats = plan?.stats;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:px-8">
      {/* ── input column ── */}
      <section className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
          <label className="mb-2 block text-sm font-medium text-text">
            What&apos;s on your plate today?
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") planMyDay();
            }}
            rows={4}
            placeholder="Dump everything in plain English — durations, deadlines, priorities. e.g. “finish DSA sheet ~3h due Friday; review PR 30m today high priority; gym 1h”"
            className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2.5 text-sm leading-relaxed text-text outline-none transition-colors duration-150 placeholder:text-subtle focus:border-accent"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              onClick={() => setText(EXAMPLE_DUMP)}
              className="text-[13px] text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
            >
              Try an example
            </button>
            <Button onClick={planMyDay} disabled={busy !== "idle" || !text.trim()}>
              {busy === "parsing" ? "Reading…" : "Plan my day"}
              {busy === "idle" && <kbd className="ml-1 font-mono text-[11px] opacity-70">⌘↵</kbd>}
            </Button>
          </div>
          {source && (
            <p className="mt-2 text-[11px] text-subtle">
              {source === "gemini"
                ? "Parsed by Gemini. Edit anything below."
                : "Parsed offline. Edit anything below."}
            </p>
          )}
          {userId ? (
            <p className="mt-2 text-[11px] text-subtle">
              Signed in. Your tasks and plan are saved automatically.
            </p>
          ) : supabaseConfigured ? (
            <p className="mt-2 text-[11px] text-subtle">
              <Link
                href="/login"
                className="text-accent underline-offset-2 hover:underline"
              >
                Sign in
              </Link>{" "}
              to save your plans across devices.
            </p>
          ) : null}
        </div>

        {error && (
          <div className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px]" style={{ color: "var(--prio-high)" }}>
            {error}
          </div>
        )}

        {tasks.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[13px] font-medium uppercase tracking-wide text-subtle">
                Tasks · {tasks.filter((t) => !t.done).length}
              </h2>
              <button
                onClick={addTask}
                className="text-[13px] text-muted transition-colors hover:text-text"
              >
                + Add task
              </button>
            </div>
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onChange={(patch) => patchTask(t.id, patch)}
                onRemove={() => removeTask(t.id)}
              />
            ))}
          </div>
        )}

        {tasks.length > 0 && <Preferences prefs={prefs} onChange={(patch) => setPrefs((p) => ({ ...p, ...patch }))} />}
      </section>

      {/* ── output column ── */}
      <section className="lg:sticky lg:top-8 lg:self-start">
        {!hasPlan ? (
          <EmptyPlan busy={busy} />
        ) : (
          <div className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-text">Your day</h2>
              <span className="font-mono text-[11px] text-subtle">
                {new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>

            {stats && <RealityCheck stats={stats} overflow={plan.overflow.length} />}

            <div className="mt-5">
              <Timeline
                tasks={tasks}
                plan={plan!}
                workStart={prefs.workStart}
                workEnd={prefs.workEnd}
                focusWindows={prefs.focusWindows}
                blockedWindows={prefs.blockedWindows}
              />
            </div>

            {plan.overflow.length > 0 && <Overflow tasks={tasks} plan={plan} />}
          </div>
        )}
      </section>
    </div>
  );
}

function RealityCheck({
  stats,
  overflow,
}: {
  stats: ScheduleResult["stats"];
  overflow: number;
}) {
  const free = stats.freeMinutes;
  const load = stats.taskMinutes;
  const overcommitted = load > free;
  const plannedPct = free > 0 ? Math.min((stats.plannedMinutes / free) * 100, 100) : 0;

  return (
    <div className="rounded-lg bg-surface-2 px-3.5 py-3">
      <p className="text-[13px] text-text">
        <span className="font-semibold" style={{ color: overcommitted ? "var(--overflow)" : "var(--accent)" }}>
          {formatHoursLoose(free)} free
        </span>
        <span className="text-muted"> vs </span>
        <span className="font-semibold text-text">{formatHoursLoose(load)} of tasks</span>
        {overcommitted ? (
          <span className="text-muted"> — {overflow} won&apos;t fit today, moved to overflow.</span>
        ) : (
          <span className="text-muted"> — it all fits. </span>
        )}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full transition-[width] duration-300 [transition-timing-function:var(--ease-out)]"
          style={{ width: `${plannedPct}%`, background: "var(--accent)" }}
        />
      </div>
    </div>
  );
}

function Overflow({ tasks, plan }: { tasks: ClientTask[]; plan: ScheduleResult }) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return (
    <div className="mt-5 rounded-lg border border-dashed border-border px-3.5 py-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--overflow)" }}>
        Didn&apos;t fit today
      </h3>
      <ul className="flex flex-col gap-1.5">
        {plan.overflow.map((o) => {
          const t = byId.get(o.taskId);
          if (!t) return null;
          return (
            <li key={o.taskId} className="flex items-center gap-2 text-[13px]">
              <Dot color={priorityColor[t.priority]} />
              <span className="text-text">{t.title}</span>
              <span className="text-subtle">· {formatDuration(t.estimatedMinutes)}</span>
              <span className="ml-auto text-[11px] text-subtle">{o.reason}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EmptyPlan({ busy }: { busy: "idle" | "parsing" | "planning" }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-surface-2">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-subtle">
          <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3 8h14M7 2.5v3M13 2.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      <p className="max-w-[220px] text-[13px] text-muted">
        {busy === "planning"
          ? "Building your day…"
          : "Your timeboxed day will appear here once you plan it."}
      </p>
    </div>
  );
}
