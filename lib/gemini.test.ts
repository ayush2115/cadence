import { describe, it, expect, vi, afterEach } from "vitest";
import { parseWithGemini } from "@/lib/gemini";

afterEach(() => vi.unstubAllEnvs());

const VALID = [
  { title: "Review PR", estimatedMinutes: 30, priority: "high", deadline: "2026-07-06", type: "coding" },
];

const okResponse = (payload: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  }) as Response;

const badResponse = { ok: false, status: 500, json: async () => ({}) } as Response;

describe("parseWithGemini", () => {
  it("returns validated tasks on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(VALID));
    const out = await parseWithGemini("review PR 30m", "2026-07-06", {
      apiKey: "k", fetchImpl,
    });
    expect(out).toEqual(VALID);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries once on HTTP failure, then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(badResponse)
      .mockResolvedValueOnce(okResponse(VALID));
    const out = await parseWithGemini("x", "2026-07-06", { apiKey: "k", fetchImpl });
    expect(out).toEqual(VALID);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns null after two failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(badResponse);
    const out = await parseWithGemini("x", "2026-07-06", { apiKey: "k", fetchImpl });
    expect(out).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("passes an AbortSignal to fetch so a hung call can time out", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(VALID));
    await parseWithGemini("x", "2026-07-06", { apiKey: "k", fetchImpl });
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("returns null on schema-invalid payload (after retry)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(okResponse([{ nonsense: true }]));
    const out = await parseWithGemini("x", "2026-07-06", { apiKey: "k", fetchImpl });
    expect(out).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2); // retries once before giving up
  });

  it("returns null immediately without an API key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchImpl = vi.fn();
    const out = await parseWithGemini("x", "2026-07-06", { apiKey: undefined, fetchImpl });
    expect(out).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
