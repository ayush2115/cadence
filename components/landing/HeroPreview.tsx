"use client";

import type { ClientTask, ScheduleResult } from "@/lib/planner";
import { Timeline } from "@/components/planner/Timeline";
import { TiltCard } from "./TiltCard";

// A representative day, shaped exactly like real engine output — rendered
// through the actual Timeline component, so the hero shows the real product.
const TASKS: ClientTask[] = [
  { id: "a", title: "Review PR", estimatedMinutes: 30, priority: "high", deadline: null, type: "coding", done: false },
  { id: "b", title: "DSA graph sheet", estimatedMinutes: 120, priority: "med", deadline: null, type: "study", done: false },
  { id: "c", title: "Reply to recruiter emails", estimatedMinutes: 20, priority: "med", deadline: null, type: "personal", done: false },
  { id: "d", title: "Read system design", estimatedMinutes: 45, priority: "med", deadline: null, type: "study", done: false },
  { id: "e", title: "Gym", estimatedMinutes: 60, priority: "med", deadline: null, type: "personal", done: false },
];

const PLAN: ScheduleResult = {
  planned: [
    { taskId: "a", start: "09:00", end: "09:30", inFocus: true, locked: false },
    { taskId: "b", start: "09:35", end: "11:35", inFocus: false, locked: false },
    { taskId: "c", start: "11:40", end: "12:00", inFocus: false, locked: false },
    { taskId: "d", start: "12:05", end: "12:50", inFocus: false, locked: false },
  ],
  overflow: [{ taskId: "e", reason: "No free slot long enough today" }],
  stats: { freeMinutes: 240, plannedMinutes: 215, taskMinutes: 275 },
};

export function HeroPreview() {
  return (
    <TiltCard className="[transform-style:preserve-3d]">
      <div
        className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]"
        style={{ transform: "translateZ(36px)" }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-surface-2" />
            <span className="h-2.5 w-2.5 rounded-full bg-surface-2" />
            <span className="h-2.5 w-2.5 rounded-full bg-surface-2" />
          </span>
          <span className="font-mono text-[11px] text-subtle">cadence · today</span>
          <span className="w-8" />
        </div>

        <div className="px-4 pb-4 pt-3.5">
          <div className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-[12px]">
            <span className="font-semibold text-accent">4h free</span>
            <span className="text-muted"> vs 4.6h of tasks. 1 won&apos;t fit today.</span>
          </div>
          <Timeline
            tasks={TASKS}
            plan={PLAN}
            workStart="09:00"
            workEnd="13:00"
            focusWindows={[{ start: "09:00", end: "11:00", label: "deep" }]}
            blockedWindows={[]}
          />
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-[12px] text-subtle">
            <span style={{ color: "var(--overflow)" }}>Didn&apos;t fit:</span>
            Gym · 1h, moved to tomorrow
          </div>
        </div>
      </div>
    </TiltCard>
  );
}
