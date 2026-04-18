import { useCallback, useEffect, useState } from "react";
import type { AnalysisData } from "../components/AnalysisResult";

export interface SavedVehicle {
  id: string;
  regNumber: string;
  nickname: string;
  savedAt: number;
  analysis: AnalysisData;
}

const STORAGE_KEY = "claimcheck.savedVehicles.v1";

function read(): SavedVehicle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(vehicles: SavedVehicle[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
}

export function useSavedVehicles() {
  const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);

  useEffect(() => {
    setVehicles(read());
  }, []);

  const save = useCallback((vehicle: Omit<SavedVehicle, "id" | "savedAt">) => {
    const entry: SavedVehicle = {
      ...vehicle,
      id: crypto.randomUUID(),
      savedAt: Date.now(),
    };
    setVehicles((prev) => {
      const next = [entry, ...prev.filter((v) => v.regNumber !== entry.regNumber)];
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

  return { vehicles, save, remove };
}
