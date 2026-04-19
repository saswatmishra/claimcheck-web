import type { AnalysisData } from "../components/AnalysisResult";

type Dict = Record<string, unknown>;

function asDict(v: unknown): Dict | undefined {
  return v && typeof v === "object" ? (v as Dict) : undefined;
}

function pickString(sources: (Dict | undefined)[], keys: string[]): string | undefined {
  for (const src of sources) {
    if (!src) continue;
    for (const k of keys) {
      const v = src[k];
      if (typeof v === "string" && v.trim().length > 0) return v.trim();
      if (typeof v === "number") return String(v);
    }
  }
  return undefined;
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|shri|smt|dr|sri)\.?\b/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type NameMatch = "match" | "partial" | "mismatch" | "unknown";

export function compareNames(a?: string, b?: string): NameMatch {
  if (!a || !b) return "unknown";
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return "unknown";
  if (na === nb) return "match";
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  const overlap = [...ta].filter((t) => tb.has(t)).length;
  const minSize = Math.min(ta.size, tb.size) || 1;
  const ratio = overlap / minSize;
  if (ratio >= 0.6) return "partial";
  return "mismatch";
}

function maskTail(value: string | undefined, tail = 4): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/\s+/g, "");
  if (cleaned.length <= tail) return cleaned.toUpperCase();
  return `••• ${cleaned.slice(-tail).toUpperCase()}`;
}

export interface VehicleDetailsView {
  identity: {
    regNumber?: string;
    makeModel?: string;
    fuel?: string;
    chassisLast4?: string;
    engineLast4?: string;
    color?: string;
    year?: string;
  };
  owners: {
    rcOwner?: string;
    insuranceHolder?: string;
    match: NameMatch;
  };
  validity: {
    rcFitnessExpiry?: string;
    pucExpiry?: string;
    insuranceExpiry?: string;
  };
  insurance: {
    policyNumber?: string;
    insurer?: string;
    idv?: string;
    policyType?: string;
  };
  dl: {
    provided: boolean;
    holderName?: string;
    validUpto?: string;
    matchToRcOwner: NameMatch;
  };
  hasAny: boolean;
}

function pickCheckedValue(root: Dict, label: string): string | undefined {
  const checked = root.checked;
  if (!Array.isArray(checked)) return undefined;

  for (const item of checked) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Dict;
    if (rec.label !== label) continue;
    const value = rec.value;
    if (typeof value !== "string") return undefined;
    const out = value.trim();
    if (!out || out === "Unknown" || out === "Not checked") return undefined;
    return out;
  }

  return undefined;
}

export function extractVehicleDetails(data: AnalysisData): VehicleDetailsView {
  const root = data as unknown as Dict;
  const vehicle = asDict(root.vehicle);
  const rc = asDict(root.rc);
  const policy = asDict(root.policy);
  const insurance = asDict(root.insurance);
  const owners = asDict(root.owners);
  const extracted = asDict(root.extracted);
  const exRc = asDict(extracted?.rc);
  const exPolicy = asDict(extracted?.policy);
  const exDl = asDict(extracted?.dl);

  const make = pickString([vehicle, rc, exRc], ["make", "manufacturer"]);
  const model = pickString([vehicle, rc, exRc], ["model", "vehicleModel"]);
  const explicitMakeModel = pickString([vehicle, rc, exRc], ["makeModel", "model_name"]);
  const joined = [make, model].filter(Boolean).join(" ");
  const makeModel = explicitMakeModel ?? (joined.length > 0 ? joined : undefined);

  const chassisLast4Direct = pickString(
    [vehicle, rc, exRc],
    ["chassisLast4"],
  );
  const engineLast4Direct = pickString(
    [vehicle, rc, exRc],
    ["engineLast4"],
  );

  const chassis = pickString(
    [vehicle, rc, exRc],
    ["chassisNumber", "chassis", "chassisNo"],
  );
  const engine = pickString(
    [vehicle, rc, exRc],
    ["engineNumber", "engine", "engineNo"],
  );

  const rcOwner = pickString(
    [owners, rc, vehicle, root, exRc],
    ["rcOwner", "ownerName", "owner", "registeredOwner", "rc_owner_name"],
  ) ?? pickCheckedValue(root, "RC Owner");
  const insuranceHolder = pickString(
    [owners, policy, insurance, root, exPolicy],
    [
      "insuranceHolder",
      "insuredName",
      "policyHolder",
      "policyholderName",
      "insured_name",
      "holderName",
    ],
  ) ?? pickCheckedValue(root, "Policyholder");
  const dlHolder =
    pickString([exDl], ["holderName"]) ?? pickCheckedValue(root, "DL Holder");
  const dlValidUpto =
    pickString([exDl], ["validUpto", "validUptoIso"]) ??
    pickCheckedValue(root, "DL Valid Upto");
  const dlProvidedRaw = exDl?.provided;
  const dlProvided =
    typeof dlProvidedRaw === "boolean"
      ? dlProvidedRaw
      : Boolean(dlHolder || dlValidUpto);

  const view: VehicleDetailsView = {
    identity: {
      regNumber: pickString(
        [vehicle, rc, root, exRc, exPolicy],
        ["regNumber", "registrationNumber", "regNo", "registration_no", "vehicleNumber"],
      )?.toUpperCase(),
      makeModel: makeModel || undefined,
      fuel: pickString([vehicle, rc, exRc], ["fuel", "fuelType", "fuel_type"]),
      chassisLast4: chassisLast4Direct ?? maskTail(chassis),
      engineLast4: engineLast4Direct ?? maskTail(engine),
      color: pickString([vehicle, rc, exRc], ["color", "colour"]),
      year: pickString(
        [vehicle, rc, exRc],
        ["year", "manufactureYear", "mfgYear", "yearOfMfg"],
      ),
    },
    owners: {
      rcOwner,
      insuranceHolder,
      match: compareNames(rcOwner, insuranceHolder),
    },
    validity: {
      rcFitnessExpiry: pickString(
        [rc, vehicle, root, exRc],
        ["fitnessUpto", "fitnessExpiry", "rcExpiry", "validUpto", "fitnessExpiryIso"],
      ),
      pucExpiry: pickString(
        [rc, vehicle, root, exRc],
        ["pucExpiry", "pucValidTill", "puc", "pucExpiryIso"],
      ),
      insuranceExpiry: pickString(
        [policy, insurance, root, exPolicy],
        ["expiryDate", "validTill", "validUpto", "endDate", "policyExpiry", "expiryIso"],
      ),
    },
    insurance: {
      policyNumber: pickString(
        [policy, insurance, exPolicy],
        ["policyNumber", "policyNo", "policy_no"],
      ),
      insurer: pickString(
        [policy, insurance, exPolicy],
        ["insurer", "insurerName", "company", "insuranceCompany"],
      ),
      idv: pickString([policy, insurance, exPolicy], ["idv", "IDV", "insuredDeclaredValue"]),
      policyType: pickString(
        [policy, insurance, exPolicy],
        ["policyType", "type", "coverType"],
      ),
    },
    dl: {
      provided: dlProvided,
      holderName: dlHolder,
      validUpto: dlValidUpto,
      matchToRcOwner: compareNames(rcOwner, dlHolder),
    },
    hasAny: false,
  };

  view.hasAny = [
    ...Object.values(view.identity),
    view.owners.rcOwner,
    view.owners.insuranceHolder,
    ...Object.values(view.validity),
    ...Object.values(view.insurance),
    view.dl.holderName,
    view.dl.validUpto,
  ].some((v) => typeof v === "string" && v.length > 0);

  return view;
}

export function formatDateLike(value?: string): string | undefined {
  if (!value) return undefined;
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime()) && /\d{4}/.test(value)) {
    return iso.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }
  return value;
}
