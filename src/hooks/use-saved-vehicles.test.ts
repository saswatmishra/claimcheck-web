import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSavedVehicles, useSavedVehicles } from "./use-saved-vehicles";
import type { AnalysisResult } from "../types/analysis";

const analysis: AnalysisResult = { risk: "GREEN", summary: "Test report", findings: [], fixes: [] };
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("saved vehicles", () => {
  it("normalizes registration numbers and preserves reminder choices on recheck", () => {
    const { result } = renderHook(useSavedVehicles);
    act(() => { result.current.save({ regNumber: "od 02-ab 1234", nickname: "Car", analysis }); });
    const id = result.current.vehicles[0].id;
    act(() => result.current.setReminderEnabled(id, 30, false));
    act(() => { result.current.save({ regNumber: "OD02AB1234", nickname: "Updated", analysis }); });
    expect(result.current.vehicles).toHaveLength(1);
    expect(result.current.vehicles[0]).toMatchObject({ id, regNumber: "OD02AB1234", nickname: "Updated" });
    expect(result.current.vehicles[0].reminders?.find((rule) => rule.daysBefore === 30)?.enabled).toBe(false);
    expect(loadSavedVehicles()).toEqual(result.current.vehicles);
  });

  it("reports storage failures before claiming a vehicle was saved", () => {
    const { result } = renderHook(useSavedVehicles);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota exceeded"); });
    expect(() => act(() => { result.current.save({ regNumber: "OD02AB1234", nickname: "Car", analysis }); })).toThrow("quota exceeded");
    expect(result.current.vehicles).toHaveLength(0);
  });

  it("ignores malformed saved reports", () => {
    localStorage.setItem("claimcheck.savedVehicles.v1", JSON.stringify([{ id: "bad", regNumber: "OD02AB1234", savedAt: 1, analysis: { ...analysis, findings: [null] } }]));
    expect(loadSavedVehicles()).toEqual([]);
  });
});
