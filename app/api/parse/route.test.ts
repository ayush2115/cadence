import { describe, it, expect, vi, afterEach } from "vitest";
import { POST } from "@/app/api/parse/route";

afterEach(() => vi.unstubAllEnvs());

const post = (body: unknown) =>
  POST(
    new Request("http://test/api/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("POST /api/parse", () => {
  it("falls back to the deterministic parser when no API key is set", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await post({ text: "review PR 30m today high priority", today: "2026-07-06" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("fallback");
    expect(body.tasks).toEqual([
      { title: "Review PR", estimatedMinutes: 30, priority: "high",
        deadline: "2026-07-06", type: "coding" },
    ]);
  });

  it("rejects empty text with 400", async () => {
    const res = await post({ text: "" });
    expect(res.status).toBe(400);
  });

  it("rejects a missing body with 400", async () => {
    const res = await POST(new Request("http://test/api/parse", { method: "POST", body: "nope" }));
    expect(res.status).toBe(400);
  });
});
