import { calendarDaysBetween, validDateISO } from "../shared/documents.js";

export function formatDate(expiryIso: string | null) {
  if (!validDateISO(expiryIso)) return "—";
  const dt = new Date(`${expiryIso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return expiryIso;
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function daysUntil(expiryIso?: string | null): number | null {
  if (!expiryIso) return null;
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return calendarDaysBetween(todayIso, expiryIso);
}
