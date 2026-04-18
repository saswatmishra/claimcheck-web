import { FiEye, FiTrash2, FiTruck } from "react-icons/fi";
import RiskBadge from "./RiskBadge";
import type { SavedVehicle } from "../hooks/use-saved-vehicles";

interface SavedVehiclesListProps {
  vehicles: SavedVehicle[];
  onView: (vehicle: SavedVehicle) => void;
  onRemove: (id: string) => void;
}

export default function SavedVehiclesList({
  vehicles,
  onView,
  onRemove,
}: SavedVehiclesListProps) {
  if (vehicles.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-2">
        <FiTruck className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Saved vehicles
        </h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {vehicles.length}
        </span>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((v) => (
          <li
            key={v.id}
            className="group flex flex-col rounded-xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-elevated"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-semibold tracking-wide text-foreground">
                  {v.regNumber}
                </p>
                {v.nickname && (
                  <p className="truncate text-xs text-muted-foreground">{v.nickname}</p>
                )}
              </div>
              <RiskBadge risk={v.analysis.risk} />
            </div>
            <p className="mb-4 line-clamp-2 text-xs text-muted-foreground">
              {v.analysis.summary}
            </p>
            <div className="mt-auto flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                {new Date(v.savedAt).toLocaleDateString()}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onView(v)}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-accent"
                >
                  <FiEye className="h-3.5 w-3.5" />
                  View
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(v.id)}
                  className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-risk-red-bg hover:text-risk-red"
                  aria-label="Remove"
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
