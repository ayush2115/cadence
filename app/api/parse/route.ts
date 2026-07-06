import { z } from "zod";
import { parseWithGemini } from "@/lib/gemini";
import { parseFallback } from "@/lib/parse-fallback";

const BodySchema = z.object({
  text: z.string().min(1).max(4000),
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
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
  const { text } = parsed.data;
  const today = parsed.data.today ?? new Date().toISOString().slice(0, 10);

  const fromGemini = await parseWithGemini(text, today);
  const tasks = fromGemini ?? parseFallback(text, today);
  return Response.json({ tasks, source: fromGemini ? "gemini" : "fallback" });
}
