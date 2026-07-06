import { z } from "zod";
import { schedule } from "@/lib/scheduler";
import { hhmmToMinutes, minutesToHhmm, isoToOffsetMin } from "@/lib/time";

const HHMM = z.string().regex(/^(?:[01]?\d|2[0-3]):[0-5]\d$/, "expected HH:MM");

/**
 * True only for a real calendar date. `new Date(Date.UTC(y, m-1, d))` rolls
 * over out-of-range parts (month 13, Feb 30), so we reject anything that does
 * not round-trip back to the same y/m/d.
 */
const isRealCalendarDate = (s: string): boolean => {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d
  );
};

const WindowSchema = z.object({
  start: HHMM,
  end: HHMM,
  label: z.string().max(40).optional(),
});

const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  estimatedMinutes: z.number().int().min(1).max(1440),
  priority: z.enum(["low", "med", "high"]).default("med"),
  deadline: z.string().nullable().default(null),
  type: z.string().max(40).nullable().default(null),
  dependsOn: z.array(z.string()).default([]),
});

const BodySchema = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .refine(isRealCalendarDate, "expected a real calendar date"),
  tasks: z.array(TaskSchema).min(1).max(100),
  preferences: z
    .object({
      workStart: HHMM.default("09:00"),
      workEnd: HHMM.default("18:00"),
      focusWindows: z.array(WindowSchema).max(10).default([]),
      blockedWindows: z.array(WindowSchema).max(20).default([]),
      bufferMinutes: z.number().int().min(0).max(120).default(0),
    })
    .refine((p) => hhmmToMinutes(p.workStart) < hhmmToMinutes(p.workEnd), {
      message: "workStart must be before workEnd",
    }),
  locked: z
    .array(z.object({ taskId: z.string().min(1), start: HHMM, end: HHMM }))
    .max(50)
    .default([]),
});

const toInterval = (w: { start: string; end: string; label?: string }) => ({
  startMin: hhmmToMinutes(w.start),
  endMin: hhmmToMinutes(w.end),
  label: w.label,
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { day, tasks, preferences, locked } = parsed.data;

  const result = schedule({
    dayStartMin: hhmmToMinutes(preferences.workStart),
    dayEndMin: hhmmToMinutes(preferences.workEnd),
    blocked: preferences.blockedWindows.map(toInterval),
    focus: preferences.focusWindows.map(toInterval),
    bufferMin: preferences.bufferMinutes,
    locked: locked.map((l) => ({
      taskId: l.taskId,
      startMin: hhmmToMinutes(l.start),
      endMin: hhmmToMinutes(l.end),
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      estimatedMinutes: t.estimatedMinutes,
      priority: t.priority,
      deadlineOffsetMin: t.deadline ? isoToOffsetMin(t.deadline, day) : null,
      dependsOn: t.dependsOn,
      type: t.type,
    })),
  });

  return Response.json({
    planned: result.planned.map((p) => ({
      taskId: p.taskId,
      start: minutesToHhmm(p.startMin),
      end: minutesToHhmm(p.endMin),
      inFocus: p.inFocus,
      locked: p.locked ?? false,
    })),
    overflow: result.overflow,
    stats: result.stats,
  });
}
