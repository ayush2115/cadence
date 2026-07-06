/** "HH:MM" wall-clock -> minutes since midnight. Throws on invalid input. */
export function hhmmToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) throw new Error(`Invalid time "${hhmm}" — expected HH:MM`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Invalid time "${hhmm}" — expected HH:MM`);
  return h * 60 + min;
}

/** Minutes since midnight -> zero-padded "HH:MM". */
export function minutesToHhmm(totalMin: number): string {
  const clamped = Math.max(0, Math.round(totalMin));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Minutes from 00:00 of `day` (YYYY-MM-DD) to the deadline instant.
 * A date-only deadline means "by end of that day" (23:59).
 * Both sides parse in server-local time, so the difference is TZ-consistent.
 */
export function isoToOffsetMin(iso: string, day: string): number | null {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso.trim());
  const target = new Date(dateOnly ? `${iso.trim()}T23:59:00` : iso);
  if (Number.isNaN(target.getTime())) return null;
  const dayStart = new Date(`${day}T00:00:00`);
  if (Number.isNaN(dayStart.getTime())) return null;
  return Math.round((target.getTime() - dayStart.getTime()) / 60000);
}
