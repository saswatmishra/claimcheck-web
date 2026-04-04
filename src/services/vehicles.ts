type ReminderRule = {
  daysBefore: number; // 30, 15, 7, 1
  enabled: boolean;
};

export type SavedVehicle = {
  vehicleNo: string;
  expiryIso: string | null;
  policyType: string;
  insurer: string;
  savedAt: string;

  reminders?: ReminderRule[];
  lastRemindedAt?: string;
};

const KEY = "claimcheck_saved_vehicles_v1";

const DEFAULT_REMINDERS: ReminderRule[] = [
  { daysBefore: 30, enabled: true },
  { daysBefore: 15, enabled: true },
  { daysBefore: 7, enabled: true },
  { daysBefore: 1, enabled: true },
];

function normalizeVehicle(v: SavedVehicle): SavedVehicle {
  return {
    ...v,
    reminders:
      v.reminders && v.reminders.length > 0
        ? v.reminders
        : DEFAULT_REMINDERS.map((r) => ({ ...r })),
  };
}

export function loadVehicles(): SavedVehicle[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeVehicle);
  } catch {
    return [];
  }
}

function saveVehicles(list: SavedVehicle[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function saveVehicle(v: SavedVehicle) {
  const list = loadVehicles();

  const normalized = normalizeVehicle(v);

  const next = [
    normalized,
    ...list.filter((x) => x.vehicleNo !== normalized.vehicleNo),
  ].slice(0, 10);

  saveVehicles(next);
}

export function removeVehicle(vehicleNo: string) {
  const list = loadVehicles().filter((x) => x.vehicleNo !== vehicleNo);
  saveVehicles(list);
}

export function clearVehicles() {
  localStorage.removeItem(KEY);
}

/**
 * Toggle a reminder rule for a vehicle.
 * - If rule exists => flip enabled
 * - If missing => add as enabled
 */
export function toggleReminder(vehicleNo: string, daysBefore: number) {
  const list = loadVehicles();
  const next = list.map((v) => {
    if (v.vehicleNo !== vehicleNo) return v;

    const reminders = (v.reminders ?? DEFAULT_REMINDERS).map((r) => ({ ...r }));
    const idx = reminders.findIndex((r) => r.daysBefore === daysBefore);

    if (idx >= 0) {
      reminders[idx].enabled = !reminders[idx].enabled;
    } else {
      reminders.push({ daysBefore, enabled: true });
    }

    reminders.sort((a, b) => b.daysBefore - a.daysBefore); // 30,15,7,1

    return { ...v, reminders };
  });

  saveVehicles(next);
}

/**
 * Set enabled state explicitly (nice for checkbox onChange).
 */
export function setReminderEnabled(
  vehicleNo: string,
  daysBefore: number,
  enabled: boolean
) {
  const list = loadVehicles();
  const next = list.map((v) => {
    if (v.vehicleNo !== vehicleNo) return v;

    const reminders = (v.reminders ?? DEFAULT_REMINDERS).map((r) => ({ ...r }));
    const idx = reminders.findIndex((r) => r.daysBefore === daysBefore);

    if (idx >= 0) reminders[idx].enabled = enabled;
    else reminders.push({ daysBefore, enabled });

    reminders.sort((a, b) => b.daysBefore - a.daysBefore);

    return { ...v, reminders };
  });

  saveVehicles(next);
}

/**
 * For in-app reminders later: store when we last showed a reminder toast/banner.
 */
export function updateLastRemindedAt(vehicleNo: string, iso = new Date().toISOString()) {
  const list = loadVehicles();
  const next = list.map((v) =>
    v.vehicleNo === vehicleNo ? { ...v, lastRemindedAt: iso } : v
  );
  saveVehicles(next);
}
