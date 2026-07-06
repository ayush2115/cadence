# Cadence — Design

> An AI day planner that auto-schedules your tasks by priority, deadline, and focus windows.

Cadence turns a plain-English "brain dump" of tasks into a realistic, timeboxed day. An
LLM extracts structure from the text; a **constraint-based scheduling engine** — the core
of the project — places each task into your real available time, respecting priorities,
deadlines, and fixed commitments, and honestly reports what does not fit.

The engineering center of gravity is the scheduler, not the LLM. The LLM is a thin input
adapter (messy text → structured tasks); the calendar/UI is thin output plumbing. The
scheduler is a real, tested algorithm.

---

## 1. Architecture

```
Browser (Next.js React UI)
  │  task text, preferences
  ▼
/api/parse  ──►  Gemini  ──►  structured Task[]      (LLM only extracts)
  │
  ▼
/api/schedule  ──►  schedule()  ──►  timed plan + overflow   (the engine)
  │
  ▼
Supabase (Postgres + Auth)  ◄── persist tasks, prefs, plan_items
  │
  ▼  (stretch)
/api/sync-gcal  ──►  Google Calendar
```

Everything runs inside one Next.js app on Vercel. API keys stay server-side. Supabase is
the only external datastore.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase
(Postgres + Auth) · Gemini `gemini-2.5-flash` · Vercel. Single language (TS) end to end.

---

## 2. The scheduler engine (`lib/scheduler.ts`) — the core

### 2.1 Design principle: a pure, timezone-free function

The engine operates entirely on **integer minutes since the start of the target day**. All
wall-clock times ("09:00"), ISO deadlines, and dates are converted to minute offsets by a
thin adapter *before* the engine runs, and plan items are converted back to timestamps
*after*. This keeps the core a pure, deterministic function — no `Date`, no timezone
math, no I/O — which makes it trivially unit-testable and easy to reason about.

### 2.2 Contract

```ts
schedule(input: SchedulerInput): SchedulerResult
```

```ts
type Priority = "low" | "med" | "high";

interface SchedulerTask {
  id: string;
  estimatedMinutes: number;        // > 0
  priority: Priority;              // default "med"
  deadlineOffsetMin: number | null;// minutes from day start; null = no deadline
  dependsOn?: string[];            // task ids that must precede this (v2)
  type?: string | null;            // "coding" | "study" | ... (matched to focus labels)
}

interface Interval { startMin: number; endMin: number; label?: string }

interface SchedulerInput {
  dayStartMin: number;             // e.g. 540 = 09:00
  dayEndMin: number;               // e.g. 1080 = 18:00
  blocked: Interval[];             // lunch, standup, class — carved out of the day
  focus:   Interval[];             // deep-work windows (labelled)
  tasks:   SchedulerTask[];
  bufferMin?: number;              // gap inserted between placed tasks (default 0)
}

interface PlanItem { taskId: string; startMin: number; endMin: number; inFocus: boolean }

interface SchedulerResult {
  planned:  PlanItem[];
  overflow: { taskId: string; reason: string }[];   // honest "did not fit" list
  stats: { freeMinutes: number; plannedMinutes: number; taskMinutes: number };
}
```

**Overflow is a first-class output, not an error.** Telling the user "7h of tasks, 5.5h
free — these three won't fit today" is the product's whole reason to exist.

### 2.3 Algorithm — v1: Earliest-Deadline-First + first-fit

1. **Free intervals** = `[dayStart, dayEnd)` minus `blocked`, merged and sorted.
2. **Sort tasks**: earliest `deadlineOffsetMin` first (null = +∞); tie-break by priority
   (high > med > low); then by longest duration first (pack big rocks first).
3. **Place** each task in the first free interval where it fits (`estimatedMinutes` +
   `bufferMin`). Prefer a **focus** window when the task is high-priority or its `type`
   matches a focus label. Split the interval; carry the remainder forward.
4. **Overflow**: a task that fits nowhere goes to the overflow list with a reason.
5. Return `planned` + `overflow` + `stats`.

**Why greedy?** The general problem (durations + deadlines + priorities + fixed blocks +
dependencies) is NP-hard (job-shop / bin-packing family). EDF is *provably optimal for
minimizing maximum lateness on a single machine*, so it is a principled, explainable
heuristic — not a hack. Complexity: sorting dominates, **O(n log n)**.

### 2.4 Roadmap (added incrementally, each with tests)

| Upgrade | Algorithm |
|---|---|
| Value-max when overcommitted | **Weighted interval scheduling** (DP, O(n log n)) — keep the highest-value set that fits |
| Task dependencies | **Topological sort** before EDF; never place a task before its prerequisites |
| Overlapping fixed blocks | **Interval partitioning** for free-interval computation |
| Re-plan on slip | keep `locked`/done items fixed, re-pack the rest |
| Split long tasks | place a task across multiple free intervals |

---

## 3. Data model (Supabase)

```
preferences  (user_id, work_start, work_end, focus_windows jsonb, blocked_windows jsonb, buffer_min)
tasks        (id, user_id, title, estimated_minutes, priority, deadline, type, status, created_at)
plan_items   (id, user_id, task_id, start_time, end_time, day)
```

Row-Level Security on every table (`user_id = auth.uid()`); access granted explicitly
(auto-expose off, auto-RLS on).

---

## 4. API contract

- `POST /api/parse` → `{ text }` → `{ tasks: Task[] }`. Gemini in strict-JSON mode;
  validate server-side; on failure retry once, then fall back to a deterministic parser
  so the app works even with no key / offline.
- `POST /api/schedule` → `{ tasks, preferences, day }` → `SchedulerResult`. Pure wrapper
  around `schedule()` plus the time↔minutes adapter.
- `POST /api/sync-gcal` → stretch.

---

## 5. Scope

**v1 (ship):** landing page · auth (email/password + Google) · brain-dump → parse →
schedule → timeline UI · overflow + reality-check · edit/mark-done/regenerate · persistence.

**Stretch (post-v1):** "Connect Google Calendar" two-way sync — scaffolded in the UI as an
opt-in toggle, but the OAuth-scope + sync work is deferred to keep v1 low-risk.

Auth and calendar are decoupled by design: logging in with Google needs only basic
profile scope; calendar access is a separate, opt-in "Connect" action so login stays
frictionless and the app avoids Google's app-verification review for v1.

---

## 6. Build milestones

0. Scaffold + repo ✅
1. **Scheduler engine + unit tests** (EDF/first-fit → WIS → deps → re-plan)
2. API routes (`/api/schedule`, `/api/parse` with fallback)
3. UI (landing · login · planner: input, prefs, timeline, overflow)
4. Supabase persistence + auth (email/password, then Google)
5. Deploy to Vercel · README · polish

Each milestone lands as several small, honest commits.
