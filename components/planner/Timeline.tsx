"use client";

import { hhmmToMinutes } from "@/lib/time";
import {
  type ClientTask,
  type ScheduleResult,
  formatDuration,
} from "@/lib/planner";
import { Dot, priorityColor } from "@/components/ui";

const PX_PER_MIN = 1.5;
const GUTTER = 52; // px reserved for hour labels

function fmtHour(min: number): string {
  const h = Math.floor(min / 60);
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${suffix}`;
}

export function Timeline({
  tasks,
  plan,
  workStart,
  workEnd,
  focusWindows,
  blockedWindows,
}: {
  tasks: ClientTask[];
  plan: ScheduleResult;
  workStart: string;
  workEnd: string;
  focusWindows: { start: string; end: string; label?: string }[];
  blockedWindows: { start: string; end: string; label?: string }[];
}) {
  const dayStart = hhmmToMinutes(workStart);
  const dayEnd = hhmmToMinutes(workEnd);
  const span = Math.max(dayEnd - dayStart, 60);
  const height = span * PX_PER_MIN;
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const top = (min: number) => (min - dayStart) * PX_PER_MIN;

  const hourLines: number[] = [];
  for (let m = Math.ceil(dayStart / 60) * 60; m <= dayEnd; m += 60) hourLines.push(m);

  return (
    <div className="relative pl-[52px]" style={{ height }}>
      {/* hour gridlines + labels */}
      {hourLines.map((m) => (
        <div
          key={m}
          className="absolute inset-x-0 flex items-center"
          style={{ top: top(m) }}
        >
          <span
            className="absolute left-0 -translate-y-1/2 font-mono text-[11px] tabular-nums text-subtle"
            style={{ width: GUTTER - 12 }}
          >
            {fmtHour(m)}
          </span>
          <div className="h-px w-full bg-border" />
        </div>
      ))}

      {/* focus windows (shaded washes behind tasks) */}
      {focusWindows.map((f, i) => {
        const s = hhmmToMinutes(f.start);
        const e = hhmmToMinutes(f.end);
        return (
          <div
            key={`focus-${i}`}
            className="absolute inset-x-0 rounded-lg"
            style={{
              top: top(s),
              height: (e - s) * PX_PER_MIN,
              background: "var(--focus-wash)",
            }}
          >
            <span className="absolute right-2.5 top-1.5 text-[9.5px] font-medium uppercase tracking-wider text-accent/55">
              {f.label ?? "focus"}
            </span>
          </div>
        );
      })}

      {/* blocked windows (muted, striped) */}
      {blockedWindows.map((b, i) => {
        const s = hhmmToMinutes(b.start);
        const e = hhmmToMinutes(b.end);
        return (
          <div
            key={`block-${i}`}
            className="absolute right-0 flex items-center rounded-md"
            style={{
              top: top(s),
              height: (e - s) * PX_PER_MIN,
              left: GUTTER - 8,
              background:
                "repeating-linear-gradient(-45deg, var(--surface-2), var(--surface-2) 6px, transparent 6px, transparent 12px)",
              border: "1px solid var(--border)",
            }}
          >
            <span className="pl-3 text-xs font-medium text-subtle">
              {b.label ?? "blocked"}
            </span>
          </div>
        );
      })}

      {/* placed tasks */}
      {plan.planned.map((p, i) => {
        const t = byId.get(p.taskId);
        if (!t) return null;
        const s = hhmmToMinutes(p.start);
        const e = hhmmToMinutes(p.end);
        const h = Math.max((e - s) * PX_PER_MIN, 30);
        return (
          <div
            key={p.taskId}
            className="animate-rise group absolute right-0 overflow-hidden rounded-lg border px-3 py-1.5 shadow-[var(--shadow-sm)] transition-shadow duration-150 hover:shadow-[var(--shadow-md)]"
            style={{
              top: top(s),
              height: h,
              left: GUTTER - 4,
              background: p.inFocus
                ? "color-mix(in oklab, var(--accent) 8%, var(--surface))"
                : "var(--surface)",
              animationDelay: `${Math.min(i * 45, 400)}ms`,
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <Dot color={priorityColor[t.priority]} />
                <span className="truncate text-sm font-medium text-text">
                  {t.title}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-subtle">
                {p.start}–{p.end}
              </span>
            </div>
            {h > 42 && (
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                <span>{formatDuration(e - s)}</span>
                {t.type && <span className="text-subtle">· {t.type}</span>}
                {p.inFocus && <span className="text-accent">· focus</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
