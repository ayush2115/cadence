import type { ParsedTask, Priority } from "./types";

const WEEKDAYS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

const TYPE_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(dsa|leetcode|study|read|reading|revise|learn|course|lecture|assignment)\b/i, "study"],
  [/\b(pr|code|coding|bug|fix|deploy|review|api|refactor|feature|ship)\b/i, "coding"],
  [/\b(gym|run|walk|workout|meditate|groceries|chore|laundry|clean)\b/i, "personal"],
];

function extractDeadline(
  chunk: string,
  today: string
): { deadline: string | null; cleaned: string } {
  const re =
    /\b(?:(?:due|by)\s+)?(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
  const m = re.exec(chunk);
  if (!m) return { deadline: null, cleaned: chunk };
  const word = m[1].toLowerCase();
  const base = new Date(`${today}T12:00:00`);
  let delta = 0;
  if (word === "tomorrow") delta = 1;
  else if (word !== "today") delta = (WEEKDAYS.indexOf(word) - base.getDay() + 7) % 7;
  const d = new Date(base.getTime() + delta * 86400000);
  return { deadline: d.toISOString().slice(0, 10), cleaned: chunk.replace(m[0], " ") };
}

function extractDuration(chunk: string): { minutes: number | null; cleaned: string } {
  const hourRe =
    /~?\s*(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?(?![a-z])(?:\s*(\d+)\s*m(?:in(?:utes?)?|ins?)?\b)?/i;
  const minRe = /~?\s*(\d+)\s*m(?:in(?:utes?)?|ins?)?\b/i;
  const h = hourRe.exec(chunk);
  if (h) {
    const minutes = Math.round(parseFloat(h[1]) * 60) + (h[2] ? parseInt(h[2], 10) : 0);
    return { minutes, cleaned: chunk.replace(h[0], " ") };
  }
  const m = minRe.exec(chunk);
  if (m) {
    return { minutes: parseInt(m[1], 10), cleaned: chunk.replace(m[0], " ") };
  }
  return { minutes: null, cleaned: chunk };
}

function extractPriority(chunk: string): { priority: Priority; cleaned: string } {
  const high = /\b(?:high\s*prio(?:rity)?|urgent|asap|critical|important|p1)\b/i.exec(chunk);
  if (high) return { priority: "high", cleaned: chunk.replace(high[0], " ") };
  const low = /\b(?:low\s*prio(?:rity)?|whenever|someday|optional|p3)\b/i.exec(chunk);
  if (low) return { priority: "low", cleaned: chunk.replace(low[0], " ") };
  return { priority: "med", cleaned: chunk };
}

function inferType(originalChunk: string): string | null {
  for (const [re, type] of TYPE_KEYWORDS) {
    if (re.test(originalChunk)) return type;
  }
  return null;
}

function cleanTitle(residue: string): string {
  const cleaned = residue
    .replace(/\s+/g, " ")
    .replace(/^[\s,.\-–—:;~]+|[\s,.\-–—:;~]+$/g, "")
    .trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Deterministic offline parser: same shape as the Gemini output, so the app
 * works with no API key. Intentionally simple — the LLM handles messy text;
 * this handles the common "task ~3h due friday high priority" patterns.
 */
export function parseFallback(text: string, today: string): ParsedTask[] {
  return text
    .split(/[;\n]+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((chunk) => {
      const dl = extractDeadline(chunk, today);
      const dur = extractDuration(dl.cleaned);
      const pr = extractPriority(dur.cleaned);
      const title = cleanTitle(pr.cleaned) || chunk.trim();
      return {
        title,
        estimatedMinutes: dur.minutes ?? 60,
        priority: pr.priority,
        deadline: dl.deadline,
        type: inferType(chunk),
      };
    });
}
