import {
  FiAlertTriangle,
  FiCheck,
  FiFileText,
  FiHelpCircle,
  FiShield,
  FiTruck,
  FiUser,
  FiX,
} from "react-icons/fi";
import { LuCalendarClock } from "react-icons/lu";
import type { IconType } from "react-icons";
import type { AnalysisData } from "./AnalysisResult";
import { extractVehicleDetails, formatDateLike, type NameMatch } from "../lib/vehicle-details";

const matchConfig: Record<
  NameMatch,
  { label: string; className: string; Icon: IconType }
> = {
  match: {
    label: "Names match",
    className: "bg-risk-green-bg text-risk-green border-risk-green/20",
    Icon: FiCheck,
  },
  partial: {
    label: "Partial match",
    className: "bg-risk-amber-bg text-risk-amber-foreground border-risk-amber/30",
    Icon: FiAlertTriangle,
  },
  mismatch: {
    label: "Name mismatch",
    className: "bg-risk-red-bg text-risk-red border-risk-red/20",
    Icon: FiX,
  },
  unknown: {
    label: "Not available",
    className: "bg-muted text-muted-foreground border-border",
    Icon: FiHelpCircle,
  },
};

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">
        {value ?? <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: IconType; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

export function VehicleDetails({ data }: { data: AnalysisData }) {
  const v = extractVehicleDetails(data);
  if (!v.hasAny) return null;

  const match = matchConfig[v.owners.match];
  const MatchIcon = match.Icon;

  const identityShown =
    v.identity.regNumber ||
    v.identity.makeModel ||
    v.identity.fuel ||
    v.identity.year ||
    v.identity.color ||
    v.identity.chassisLast4 ||
    v.identity.engineLast4;

  const insuranceShown =
    v.insurance.policyNumber ||
    v.insurance.insurer ||
    v.insurance.idv ||
    v.insurance.policyType;

  const validityShown =
    v.validity.rcFitnessExpiry || v.validity.pucExpiry || v.validity.insuranceExpiry;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vehicle Details
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            Extracted from your documents
          </h2>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {identityShown && (
          <div className="rounded-xl border border-border bg-background p-5">
            <SectionHeader icon={FiTruck} title="Vehicle Identity" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Registration" value={v.identity.regNumber} />
              <Field label="Make / Model" value={v.identity.makeModel} />
              <Field label="Fuel" value={v.identity.fuel} />
              <Field label="Year" value={v.identity.year} />
              <Field label="Color" value={v.identity.color} />
              <Field label="Chassis (last 4)" value={v.identity.chassisLast4} />
              <Field label="Engine (last 4)" value={v.identity.engineLast4} />
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-background p-5">
          <SectionHeader icon={FiUser} title="Owner Verification" />
          <div className="space-y-4">
            <Field label="RC Owner" value={v.owners.rcOwner} />
            <Field label="Insurance Policyholder" value={v.owners.insuranceHolder} />
            <div
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                match.className,
              ].join(" ")}
            >
              <MatchIcon className="h-3.5 w-3.5" />
              {match.label}
            </div>
          </div>
        </div>

        {validityShown && (
          <div className="rounded-xl border border-border bg-background p-5">
            <SectionHeader icon={LuCalendarClock} title="Validity" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <Field label="RC / Fitness" value={formatDateLike(v.validity.rcFitnessExpiry)} />
              <Field label="PUC" value={formatDateLike(v.validity.pucExpiry)} />
              <Field label="Insurance" value={formatDateLike(v.validity.insuranceExpiry)} />
            </div>
          </div>
        )}

        {insuranceShown && (
          <div className="rounded-xl border border-border bg-background p-5">
            <SectionHeader icon={FiShield} title="Insurance Policy" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Insurer" value={v.insurance.insurer} />
              <Field label="Policy Type" value={v.insurance.policyType} />
              <Field label="Policy Number" value={v.insurance.policyNumber} />
              <Field label="IDV" value={v.insurance.idv} />
            </div>
          </div>
        )}
      </div>

      {!identityShown && !insuranceShown && !validityShown && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FiFileText className="h-4 w-4" />
          Limited details available from these documents.
        </div>
      )}
    </div>
  );
}

export default VehicleDetails;
