import { describe, it, expect } from "vitest";
import { hhmmToMinutes, minutesToHhmm, isoToOffsetMin } from "@/lib/time";

describe("hhmmToMinutes", () => {
  it("converts wall-clock strings", () => {
    expect(hhmmToMinutes("09:00")).toBe(540);
    expect(hhmmToMinutes("18:30")).toBe(1110);
    expect(hhmmToMinutes("0:05")).toBe(5);
  });
  it("throws on invalid input", () => {
    expect(() => hhmmToMinutes("25:00")).toThrow();
    expect(() => hhmmToMinutes("9am")).toThrow();
    expect(() => hhmmToMinutes("09:60")).toThrow();
  });
});

describe("minutesToHhmm", () => {
  it("formats minutes as zero-padded HH:MM", () => {
    expect(minutesToHhmm(540)).toBe("09:00");
    expect(minutesToHhmm(1110)).toBe("18:30");
    expect(minutesToHhmm(5)).toBe("00:05");
  });
});

describe("isoToOffsetMin", () => {
  it("computes offset for a datetime on the target day", () => {
    expect(isoToOffsetMin("2026-07-06T17:00:00", "2026-07-06")).toBe(1020);
  });
  it("treats date-only deadlines as end of that day", () => {
    expect(isoToOffsetMin("2026-07-06", "2026-07-06")).toBe(1439);
  });
  it("handles deadlines on later days (offset > 1440)", () => {
    expect(isoToOffsetMin("2026-07-07T17:00:00", "2026-07-06")).toBe(2460);
  });
  it("returns null for garbage", () => {
    expect(isoToOffsetMin("not-a-date", "2026-07-06")).toBeNull();
  });
});
