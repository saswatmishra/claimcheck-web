import { useEffect, useMemo, useState } from "react";
import {
  loadVehicles,
  removeVehicle,
  setReminderEnabled,
  type SavedVehicle,
} from "../services/vehicles";
import { formatDate, daysUntil } from "../utils/dateUtil";
import { AiTwotoneDelete } from "react-icons/ai";
import { VscDebugRerun } from "react-icons/vsc";
import { buildIcs, downloadIcs } from "../services/reminders";

type Props = {
  onRunCheck?: (vehicleNo: string) => void; // optional hook for future "re-check this vehicle"
};

function renewalBadge(expiryIso: string | null) {
  const d = daysUntil(expiryIso);
  if (d === null)
    return {
      label: "Expiry unknown",
      cls: "bg-slate-100 text-slate-700 border-slate-200",
    };
  if (d < 0)
    return {
      label: `Expired ${Math.abs(d)}d ago`,
      cls: "bg-red-50 text-red-700 border-red-200",
    };
  if (d <= 15)
    return {
      label: `Renew in ${d}d`,
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    };
  return {
    label: `Valid (${d}d left)`,
    cls: "bg-green-50 text-green-800 border-green-200",
  };
}

export default function SavedVehicles({ onRunCheck }: Props) {
  const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);

  const refresh = () => setVehicles(loadVehicles());

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key?.includes("claimcheck_saved_vehicles")) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const sorted = useMemo(() => {
    // Sort: expired first, then renew soon, then rest by expiry date
    return [...vehicles].sort((a, b) => {
      const da = daysUntil(a.expiryIso);
      const db = daysUntil(b.expiryIso);
      const wa = da === null ? 999999 : da;
      const wb = db === null ? 999999 : db;
      return wa - wb;
    });
  }, [vehicles]);

  return (
    <div className="mt-8 border rounded-xl bg-white shadow-sm">
      <div className="p-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Saved Vehicles
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Quick glance at renewal + policy health. Stored locally in your
            browser.
          </p>
        </div>
      </div>

      <div className="border-t" />

      {sorted.length === 0 ? (
        <div className="p-6 text-sm text-slate-600">
          No saved vehicles yet. Run an analysis and click{" "}
          <b>Save this vehicle</b>.
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {sorted.map((v) => {
            const badge = renewalBadge(v.expiryIso);
            return (
              <div
                key={v.vehicleNo}
                className="border rounded-xl p-4 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-semibold text-slate-900">
                        {v.vehicleNo}
                      </p>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <div className="bg-slate-50 border rounded-lg p-2 h-full">
                        <p className="text-xs text-slate-500">Expiry</p>
                        <p className="font-small text-slate-800 break-words leading-snug">
                          {formatDate(v.expiryIso)}
                        </p>
                      </div>
                      <div className="bg-slate-50 border rounded-lg p-2 h-full">
                        <p className="text-xs text-slate-500">Insurer</p>
                        <p className="font-small text-slate-800 break-words leading-snug">
                          {v.insurer || "—"}
                        </p>
                      </div>
                      <div className="bg-slate-50 border rounded-lg p-2 h-full">
                        <p className="text-xs text-slate-500">Policy Type</p>
                        <p className="font-small text-slate-800 break-words leading-snug">
                          {v.policyType || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 border-t pt-3">
                      <p className="text-xs font-medium text-slate-700">
                        Renewal reminders
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2 text-sm">
                        {[30, 15, 7, 1].map((n) => (
                          <label
                            key={n}
                            className="flex items-center gap-2 border rounded-lg px-3 py-1 bg-white"
                          >
                            <input
                              type="checkbox"
                              checked={
                                v.reminders?.some(
                                  (r) => r.daysBefore === n && r.enabled
                                ) ?? true
                              }
                              onChange={(e) => {
                                setReminderEnabled(
                                  v.vehicleNo,
                                  n,
                                  e.target.checked
                                );
                                refresh();
                              }}
                            />
                            {n}d
                          </label>
                        ))}
                      </div>

                      <button
                        className="mt-3 border px-4 py-2 rounded-lg hover:bg-slate-50"
                        disabled={!v.expiryIso}
                        onClick={() => {
                          const ics = buildIcs({
                            title: `Renew car insurance: ${v.vehicleNo}`,
                            dateIso: v.expiryIso!,
                            description: `Insurer: ${
                              v.insurer ?? "Unknown"
                            }\nPolicy Type: ${
                              v.policyType ?? "Unknown"
                            }\nMade with ClaimCheck`,
                          });
                          downloadIcs(`renew-${v.vehicleNo}.ics`, ics);
                        }}
                      >
                        Add to Calendar
                      </button>
                    </div>

                    <p className="text-xs text-slate-500 mt-2">
                      Saved {new Date(v.savedAt).toLocaleString()}
                    </p>
                  </div>

                  <div
                    className="flex flex-col gap-2 shrink-0"
                    title="Re-Run Check"
                  >
                    <button onClick={() => onRunCheck?.(v.vehicleNo)}>
                      <VscDebugRerun size={30} />
                    </button>
                    <button
                      onClick={() => {
                        removeVehicle(v.vehicleNo);
                        refresh();
                      }}
                      title="Remove"
                    >
                      <AiTwotoneDelete size={30} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
