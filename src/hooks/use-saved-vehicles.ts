import { useCallback, useEffect, useState } from "react";
import type { AnalysisData } from "../components/AnalysisResult";
import { daysUntil } from "../utils/dateUtil";

export type ReminderRule = {
  daysBefore: number;
  enabled: boolean;
};

export interface SavedVehicle {
  id: string;
  regNumber: string;
  nickname: string;
  savedAt: number;
  analysis: AnalysisData;
  expiryIso?: string | null;
  insurer?: string;
  policyType?: string;
  reminders?: ReminderRule[];
  lastRemindedAt?: string;
}

const STORAGE_KEY = "claimcheck.savedVehicles.v1";
const DEFAULT_REMINDERS: ReminderRule[] = [
  { daysBefore: 30, enabled: true },
  { daysBefore: 15, enabled: true },
  { daysBefore: 7, enabled: true },
  { daysBefore: 1, enabled: true },
];

function normalize(vehicle: SavedVehicle): SavedVehicle {
  return {
    ...vehicle,
    reminders:
      vehicle.reminders && vehicle.reminders.length > 0
        ? vehicle.reminders
        : DEFAULT_REMINDERS.map((r) => ({ ...r })),
  };
}

export function loadSavedVehicles(): SavedVehicle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalize);
  } catch {
    return [];
  }
}

function write(vehicles: SavedVehicle[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
}

export function shouldShowVehicleReminderToday(v: SavedVehicle, now = new Date()) {
  if (!v.lastRemindedAt) return true;
  const last = new Date(v.lastRemindedAt);
  return (
    last.getFullYear() !== now.getFullYear() ||
    last.getMonth() !== now.getMonth() ||
    last.getDate() !== now.getDate()
  );
}

export function getDueReminders(vehicles: SavedVehicle[]) {
  const due: Array<{ id: string; regNumber: string; daysBefore: number }> = [];

  for (const v of vehicles) {
    const expiryIso = v.expiryIso ?? v.analysis?.extracted?.policy?.expiryIso;
    const d = daysUntil(expiryIso ?? null);
    if (d === null) continue;

    const rules = (v.reminders ?? []).filter((r) => r.enabled);
    for (const r of rules) {
      if (d === r.daysBefore) {
        due.push({ id: v.id, regNumber: v.regNumber, daysBefore: r.daysBefore });
      }
    }
  }

  return due;
}

export function markVehicleReminded(id: string, iso = new Date().toISOString()) {
  const vehicles = loadSavedVehicles();
  const next = vehicles.map((v) =>
    v.id === id ? { ...v, lastRemindedAt: iso } : v
  );
  write(next);
}

export function useSavedVehicles() {
  const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);

  useEffect(() => {
    setVehicles(loadSavedVehicles());
  }, []);

  const save = useCallback((vehicle: Omit<SavedVehicle, "id" | "savedAt">) => {
    const expiryIso =
      vehicle.expiryIso ?? vehicle.analysis?.extracted?.policy?.expiryIso ?? null;
    const insurer =
      vehicle.insurer ?? vehicle.analysis?.extracted?.policy?.insurer ?? "Unknown";
    const policyType =
      vehicle.policyType ??
      vehicle.analysis?.extracted?.policy?.policyType ??
      "Unknown";

    const entry: SavedVehicle = {
      ...vehicle,
      id: crypto.randomUUID(),
      savedAt: Date.now(),
      expiryIso,
      insurer,
      policyType,
      reminders: DEFAULT_REMINDERS.map((r) => ({ ...r })),
    };
    setVehicles((prev) => {
      const existing = prev.find((v) => v.regNumber === entry.regNumber);
      const merged: SavedVehicle = existing
        ? {
            ...entry,
            id: existing.id,
            reminders: existing.reminders ?? entry.reminders,
            lastRemindedAt: existing.lastRemindedAt,
          }
        : entry;
      const next = [merged, ...prev.filter((v) => v.regNumber !== merged.regNumber)];
      write(next);
      return next;
    });
    return entry;
  }, []);

  const remove = useCallback((id: string) => {
    setVehicles((prev) => {
      const next = prev.filter((v) => v.id !== id);
      write(next);
      return next;
    });
  }, []);

  const setReminderEnabled = useCallback(
    (id: string, daysBefore: number, enabled: boolean) => {
      setVehicles((prev) => {
        const next = prev.map((v) => {
          if (v.id !== id) return v;
          const reminders = (v.reminders ?? DEFAULT_REMINDERS).map((r) => ({ ...r }));
          const idx = reminders.findIndex((r) => r.daysBefore === daysBefore);
          if (idx >= 0) reminders[idx].enabled = enabled;
          else reminders.push({ daysBefore, enabled });
          reminders.sort((a, b) => b.daysBefore - a.daysBefore);
          return { ...v, reminders };
        });
        write(next);
        return next;
      });
    },
    [],
  );

  return { vehicles, save, remove, setReminderEnabled };
}
