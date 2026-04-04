import { daysUntil } from "../utils/dateUtil";
import type { SavedVehicle } from "./vehicles";
import { loadVehicles, updateLastRemindedAt } from "./vehicles";

export function getDueReminderDays(expiryIso?: string | null, rules?: Unknown[]) {
  const d = daysUntil(expiryIso);
  if (d === null) return [];
  const enabledRules = (rules ?? []).filter((r) => r.enabled);
  return enabledRules
    .map((r) => r.daysBefore)
    .filter((daysBefore) => d === daysBefore || (daysBefore === 0 && d < 0));
}

export function buildIcs({
  title,
  dateIso,
  description,
}: {
  title: string;
  dateIso: string; // YYYY-MM-DD
  description?: string;
}) {
  const dt = dateIso.replaceAll("-", "");
  const uid = `${dt}-${Math.random().toString(16).slice(2)}@claimcheck`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ClaimCheck//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART;VALUE=DATE:${dt}`,
    `DTEND;VALUE=DATE:${dt}`, // all-day same day is ok for MVP
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description ?? "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

function escapeIcs(s: string) {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function downloadIcs(filename: string, icsText: string) {
  const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Let the download start before revoking the object URL.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}


export type DueReminder = {
  vehicleNo: string;
  daysBefore: number;
  expiryIso: string;
  insurer?: string;
  policyType?: string;
};

export function getDueReminders(now = new Date()): DueReminder[] {
  const vehicles = loadVehicles();
  const due: DueReminder[] = [];

  for (const v of vehicles) {
    if (!v.expiryIso) continue;

    const d = daysUntil(v.expiryIso);
    if (d === null) continue;

    const rules = (v.reminders ?? []).filter((r) => r.enabled);
    for (const r of rules) {
      if (d === r.daysBefore) {
        due.push({
          vehicleNo: v.vehicleNo,
          daysBefore: r.daysBefore,
          expiryIso: v.expiryIso,
          insurer: v.insurer,
          policyType: v.policyType,
        });
      }
    }
  }

  return due;
}

/**
 * Very simple "don't spam" gate:
 * show at most once per calendar day per vehicle.
 */
export function shouldShowVehicleReminderToday(v: SavedVehicle, now = new Date()) {
  if (!v.lastRemindedAt) return true;
  const last = new Date(v.lastRemindedAt);
  return (
    last.getFullYear() !== now.getFullYear() ||
    last.getMonth() !== now.getMonth() ||
    last.getDate() !== now.getDate()
  );
}

export function markVehicleReminded(vehicleNo: string) {
  updateLastRemindedAt(vehicleNo);
}
