export type SavedVehicle = {
  vehicleNo: string;
  expiryIso: string | null;
  policyType: string;
  insurer: string;
  savedAt: string; // ISO timestamp
};

const KEY = "claimcheck_saved_vehicles_v1";

export function loadVehicles(): SavedVehicle[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveVehicle(v: SavedVehicle) {
  const list = loadVehicles();

  const next = [
    v,
    ...list.filter((x) => x.vehicleNo !== v.vehicleNo),
  ].slice(0, 10);

  localStorage.setItem(KEY, JSON.stringify(next));
}

export function removeVehicle(vehicleNo: string) {
  const list = loadVehicles().filter((x) => x.vehicleNo !== vehicleNo);
  localStorage.setItem(KEY, JSON.stringify(list));
}
