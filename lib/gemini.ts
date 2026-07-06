import { z } from "zod";
import type { ParsedTask } from "./types";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const ParsedTaskSchema = z.object({
  title: z.string().min(1).max(200),
  estimatedMinutes: z.number().int().min(1).max(1440),
  priority: z.enum(["low", "med", "high"]),
  deadline: z.string().nullable().default(null),
  type: z.string().max(40).nullable().default(null),
});
const ParsedTaskArraySchema = z.array(ParsedTaskSchema).min(1).max(50);

const RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      estimatedMinutes: { type: "INTEGER" },
      priority: { type: "STRING", enum: ["low", "med", "high"] },
      deadline: { type: "STRING", nullable: true },
      type: { type: "STRING", nullable: true },
    },
    required: ["title", "estimatedMinutes", "priority"],
  },
} as const;

const prompt = (text: string, today: string) => `You convert a user's plain-English to-do dump into a JSON array of tasks.
Today's date is ${today}.
For each task output:
- "title": short imperative title
- "estimatedMinutes": integer; if unstated, infer a sensible default (30-90 depending on the task)
- "priority": "low" | "med" | "high" (default "med")
- "deadline": ISO date "YYYY-MM-DD" or null. Resolve relative dates ("Friday", "tomorrow") using today's date. A bare "today" means deadline today.
- "type": short lowercase category like "coding", "study", "personal", or null.
Never do scheduling math — only extract tasks.

User's dump:
${text}`;

/**
 * Messy text -> structured tasks via Gemini (strict JSON mode).
 * One retry, then null — the caller falls back to the offline parser.
 * The LLM only EXTRACTS; the scheduler engine does all placement math.
 */
export async function parseWithGemini(
  text: string,
  today: string,
  opts: { apiKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<ParsedTask[] | null> {
  const apiKey = "apiKey" in opts ? opts.apiKey : process.env.GEMINI_API_KEY;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 8000;
  if (!apiKey) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    // Abort a hung connection so the call reliably fails and the caller
    // falls back offline instead of blocking indefinitely.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${GEMINI_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt(text, today) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.2,
          },
        }),
        signal: ac.signal,
      });
      if (!res.ok) continue;
      const data = await res.json();
      const raw: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof raw !== "string") continue;
      const parsed = ParsedTaskArraySchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // network / JSON.parse / timeout-abort error — fall through to retry
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
