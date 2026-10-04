import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysUntil, formatDate } from "./dateUtil";

describe("dateUtil", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 19, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats valid ISO dates", () => {
    expect(formatDate("2026-04-25")).toBe("25 Apr 2026");
  });

  it("returns dash for null date", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("calculates days until future date", () => {
    expect(daysUntil("2026-04-25")).toBe(6);
  });

  it("returns negative days for past date", () => {
    expect(daysUntil("2026-04-18")).toBe(-1);
  });

  it("returns null for invalid or empty date", () => {
    expect(daysUntil("invalid-date")).toBeNull();
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil("2026-02-31")).toBeNull();
  });

  it("counts calendar days across daylight-saving changes", () => {
    vi.setSystemTime(new Date(2026, 2, 7, 12, 0, 0));
    expect(daysUntil("2026-03-09")).toBe(2);
  });
});
