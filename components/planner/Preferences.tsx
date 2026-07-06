"use client";

import { useState } from "react";
import type { PlannerPreferences, TimeWindow } from "@/lib/planner";

const inputCls =
  "h-8 rounded-md border border-border bg-surface px-2 font-mono text-[13px] tabular-nums text-text " +
  "transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none " +
  "[color-scheme:light] dark:[color-scheme:dark]";

function TimeInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-subtle">
        {label}
      </span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

export function Preferences({
  prefs,
  onChange,
}: {
  prefs: PlannerPreferences;
  onChange: (patch: Partial<PlannerPreferences>) => void;
}) {
  const [open, setOpen] = useState(false);
  const focus: TimeWindow = prefs.focusWindows[0] ?? { start: "09:00", end: "11:00", label: "deep" };
  const lunch: TimeWindow = prefs.blockedWindows[0] ?? { start: "13:00", end: "14:00", label: "lunch" };

  const setFocus = (patch: Partial<TimeWindow>) =>
    onChange({ focusWindows: [{ ...focus, ...patch }] });
  const setLunch = (patch: Partial<TimeWindow>) =>
    onChange({ blockedWindows: [{ ...lunch, ...patch }] });

  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-text">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-muted">
            <path
              d="M6.5 1.5h2l.4 1.8 1.5.6 1.6-.9 1.4 1.4-.9 1.6.6 1.5 1.8.4v2l-1.8.4-.6 1.5.9 1.6-1.4 1.4-1.6-.9-1.5.6-.4 1.8h-2l-.4-1.8-1.5-.6-1.6.9-1.4-1.4.9-1.6-.6-1.5L.6 8.5v-2l1.8-.4.6-1.5-.9-1.6L3.5 1.6l1.6.9 1.5-.6.4-1.8Z"
              stroke="currentColor"
              strokeWidth="1"
            />
            <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1" />
          </svg>
          Preferences
        </span>
        <span className="font-mono text-[11px] text-subtle">
          {prefs.workStart}–{prefs.workEnd} · focus {focus.start}–{focus.end} · {prefs.bufferMinutes}m buffer
        </span>
      </button>

      {open && (
        <div className="flex flex-wrap gap-x-6 gap-y-4 border-t border-border px-4 py-4">
          <Field label="Work hours">
            <TimeInput label="Work start" value={prefs.workStart} onChange={(v) => onChange({ workStart: v })} />
            <span className="text-subtle">–</span>
            <TimeInput label="Work end" value={prefs.workEnd} onChange={(v) => onChange({ workEnd: v })} />
          </Field>
          <Field label="Deep-focus window">
            <TimeInput label="Focus start" value={focus.start} onChange={(v) => setFocus({ start: v })} />
            <span className="text-subtle">–</span>
            <TimeInput label="Focus end" value={focus.end} onChange={(v) => setFocus({ end: v })} />
          </Field>
          <Field label="Lunch / blocked">
            <TimeInput label="Lunch start" value={lunch.start} onChange={(v) => setLunch({ start: v })} />
            <span className="text-subtle">–</span>
            <TimeInput label="Lunch end" value={lunch.end} onChange={(v) => setLunch({ end: v })} />
          </Field>
          <Field label="Buffer">
            <input
              type="number"
              min={0}
              max={60}
              step={5}
              aria-label="Buffer minutes"
              value={prefs.bufferMinutes}
              onChange={(e) => onChange({ bufferMinutes: Math.max(0, Number(e.target.value) || 0) })}
              className={`${inputCls} w-16`}
            />
            <span className="text-[13px] text-muted">min</span>
          </Field>
        </div>
      )}
    </div>
  );
}
