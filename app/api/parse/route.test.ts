import { describe, it, expect, vi, afterEach } from "vitest";

const { getSignedInUserId, parseWithGemini } = vi.hoisted(() => ({
  getSignedInUserId: vi.fn<() => Promise<string | null>>(),
  parseWithGemini: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getSignedInUserId }));
vi.mock("@/lib/gemini", () => ({ parseWithGemini }));

import { POST } from "@/app/api/parse/route";

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

const post = (body: unknown) =>
  POST(
    new Request("http://test/api/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

const FALLBACK_REVIEW_PR = [
  { title: "Review PR", estimatedMinutes: 30, priority: "high", deadline: "2026-07-06", type: "coding" },
];

describe("POST /api/parse", () => {
  it("never spends the Gemini key for signed-out callers — uses the offline parser", async () => {
    vi.stubEnv("GEMINI_API_KEY", "real-key");
    getSignedInUserId.mockResolvedValue(null);

    const res = await post({ text: "review PR 30m today high priority", today: "2026-07-06" });

    expect(res.status).toBe(200);
    expect(parseWithGemini).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.source).toBe("fallback");
    expect(body.tasks).toEqual(FALLBACK_REVIEW_PR);
  });

  it("uses Gemini for a signed-in user", async () => {
    getSignedInUserId.mockResolvedValue("user-1");
    const geminiTasks = [
      { title: "Review PR", estimatedMinutes: 25, priority: "high", deadline: null, type: "coding" },
    ];
    parseWithGemini.mockResolvedValue(geminiTasks);

    const res = await post({ text: "review PR", today: "2026-07-06" });

    expect(res.status).toBe(200);
    expect(parseWithGemini).toHaveBeenCalledWith("review PR", "2026-07-06");
    expect(await res.json()).toEqual({ tasks: geminiTasks, source: "gemini" });
  });

  it("falls back offline for a signed-in user when Gemini is unavailable", async () => {
    getSignedInUserId.mockResolvedValue("user-1");
    parseWithGemini.mockResolvedValue(null);

    const res = await post({ text: "review PR 30m today high priority", today: "2026-07-06" });

    const body = await res.json();
    expect(body.source).toBe("fallback");
    expect(body.tasks).toEqual(FALLBACK_REVIEW_PR);
  });

  it("rejects empty text with 400 without checking auth or calling Gemini", async () => {
    const res = await post({ text: "" });
    expect(res.status).toBe(400);
    expect(getSignedInUserId).not.toHaveBeenCalled();
    expect(parseWithGemini).not.toHaveBeenCalled();
  });

  it("rejects a missing body with 400", async () => {
    const res = await POST(new Request("http://test/api/parse", { method: "POST", body: "nope" }));
    expect(res.status).toBe(400);
  });
});
