"use client";

import {
  type ClientTask,
  type Priority,
  PRIORITY_LABEL,
  formatDuration,
  relativeDeadline,
  todayISO,
} from "@/lib/planner";
import { Dot, priorityColor } from "@/components/ui";

const NEXT_PRIORITY: Record<Priority, Priority> = {
  high: "med",
  med: "low",
  low: "high",
};

const DURATION_STEPS = [15, 30, 45, 60, 90, 120, 180, 240];

function stepDuration(current: number, dir: 1 | -1): number {
  if (dir === 1) {
    const next = DURATION_STEPS.find((d) => d > current);
    return next ?? Math.min(current + 30, 600);
  }
  const below = [...DURATION_STEPS].reverse().find((d) => d < current);
  return below ?? Math.max(current - 15, 5);
}

export function TaskCard({
  task,
  onChange,
  onRemove,
}: {
  task: ClientTask;
  onChange: (patch: Partial<ClientTask>) => void;
  onRemove: () => void;
}) {
  const deadlineLabel = relativeDeadline(task.deadline, todayISO());

  return (
    <div
      className={`group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors duration-150 [transition-timing-function:var(--ease-out)] hover:border-border-strong ${
        task.done ? "opacity-55" : ""
      }`}
    >
      {/* done toggle */}
      <button
        onClick={() => onChange({ done: !task.done })}
        aria-label={task.done ? "Mark not done" : "Mark done"}
        className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition-colors duration-150 hover:border-accent"
        style={{
          borderColor: task.done ? "var(--accent)" : "var(--border-strong)",
          background: task.done ? "var(--accent)" : "transparent",
        }}
      >
        {task.done && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6.5L5 9L9.5 3.5"
              stroke="var(--accent-fg)"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* title */}
      <input
        value={task.title}
        onChange={(e) => onChange({ title: e.target.value })}
        className={`min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-subtle ${
          task.done ? "line-through" : ""
        }`}
        placeholder="Task title"
      />

      {/* type */}
      {task.type && (
        <span className="hidden shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted sm:inline">
          {task.type}
        </span>
      )}

      {/* deadline */}
      {deadlineLabel && (
        <span
          className="shrink-0 text-[11px] font-medium"
          style={{
            color: deadlineLabel === "today" ? "var(--prio-high)" : "var(--text-subtle)",
          }}
        >
          {deadlineLabel}
        </span>
      )}

      {/* priority (click to cycle) */}
      <button
        onClick={() => onChange({ priority: NEXT_PRIORITY[task.priority] })}
        className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2"
        title="Change priority"
      >
        <Dot color={priorityColor[task.priority]} />
        {PRIORITY_LABEL[task.priority]}
      </button>

      {/* duration stepper */}
      <div className="flex shrink-0 items-center rounded-md border border-border">
        <button
          onClick={() => onChange({ estimatedMinutes: stepDuration(task.estimatedMinutes, -1) })}
          className="grid h-7 w-6 place-items-center text-subtle transition-colors hover:bg-surface-2 hover:text-text"
          aria-label="Less time"
        >
          −
        </button>
        <span className="w-12 text-center font-mono text-[11px] tabular-nums text-muted">
          {formatDuration(task.estimatedMinutes)}
        </span>
        <button
          onClick={() => onChange({ estimatedMinutes: stepDuration(task.estimatedMinutes, 1) })}
          className="grid h-7 w-6 place-items-center text-subtle transition-colors hover:bg-surface-2 hover:text-text"
          aria-label="More time"
        >
          +
        </button>
      </div>

      {/* remove */}
      <button
        onClick={onRemove}
        aria-label="Remove task"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-subtle opacity-0 transition-[opacity,background-color,color] duration-150 hover:bg-surface-2 hover:text-text focus-visible:opacity-100 group-hover:opacity-100"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M3.5 3.5l7 7M10.5 3.5l-7 7"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
