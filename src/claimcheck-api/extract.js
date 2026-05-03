function normalizeDate(s) {
  return (s || "")
    .replace(/\u00a0/g, " ")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(text) {
  return (text || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function cutAtStopWords(s) {
  const stopWords = [
    "address",
    "contact",
    "email",
    "policy",
    "insured value",
    "intermediary",
    "broking",
    "services",
    "branch",
    "customer id",
    "period of insurance",
    "scan to get",
    "insured value",
    "policy starts",
    "plan coverages",
    "own damage",
    "third party",
    "addons",
    "add-ons",
    "policy expires",
    "policy number",
    "reg. no",
    "reg no",
    "scan to get",
    "comprehensive plan",
  ];

  let out = (s || "").trim();

  for (const w of stopWords) {
    const idx = out.toLowerCase().indexOf(w);
    if (idx > 0) out = out.slice(0, idx).trim();
  }

  // remove trailing punctuation
  out = out.replace(/[,:;-]+$/, "").trim();

  // remove multiple spaces
  out = out.replace(/\s+/g, " ").trim();

  return out;
}

function looksLikePersonName(s) {
  if (!s) return false;
  const x = s.trim();

  // Reject obvious non-name junk
  if (x.length < 3 || x.length > 60) return false;
  if (/[0-9@]/.test(x)) return false; // numbers/emails
  if (
    /private|limited|ltd|insurance|broking|services|branch|address|contact/i.test(
      x
    )
  )
    return false;

  // Must have at least one space (first + last)
  if (!x.includes(" ")) return false;

  return true;
}

function looksLikeRcOwnerName(s) {
  if (!looksLikePersonName(s)) return false;
  if (
    /\b(?:rto|regd?|registration|vehicle|motor|car|lmv|odisha|bhubaneswar|khordha)\b/i.test(
      s,
    )
  ) {
    return false;
  }
  if (
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(
      s,
    )
  ) {
    return false;
  }
  return true;
}

const STOP_WORDS = [
  "INSURED VALUE",
  "REG. NO",
  "REG NO",
  "POLICY STARTS",
  "POLICY EXPIRES",
  "POLICY NUMBER",
  "ADDRESS",
  "EMAIL",
  "MOBILE",
  "PHONE",
  "CUSTOMER ID",
  "IDV",
  "₹",
  "RS",
];

function monthToNumber(mon) {
  const m = (mon || "").toLowerCase();
  const map = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };
  return map[m] ?? null;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Vehicle number: common Indian formats e.g. MH12AB1234, OD02AB1234
export function extractVehicleNumber(text) {
  const t = normalizeDate(text).toUpperCase();
  const m = t.match(/\b([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4})\b/);
  return m ? m[1].replace(/\s+/g, "") : null;
}

// Expiry date: try multiple patterns, then choose the best candidate near keywords
export function extractExpiryDateISO(text) {
  const t = normalizeDate(text);

  // PRIORITY 1: SBI / common insurer format: "To:24/12/2026"
  const to = t.match(/\bTo\s*:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (to) return `${to[3]}-${to[2]}-${to[1]}`;

  // PRIORITY 2: "Period of Insurance ... To: 24/12/2026"
  const block = t.match(
    /Period of Insurance[\s\S]{0,200}?\bTo\s*:\s*(\d{2})\/(\d{2})\/(\d{4})/i
  );
  if (block) return `${block[3]}-${block[2]}-${block[1]}`;

  // PRIORITY 3: Tata AIG / common motor schedule style:
  // "Period of Own Damage : From04-Apr-2026(...) To 03-Apr-2027(...)"
  const periodTo = t.match(
    /\b(?:Period\s+of\s+(?:Own\s+Damage|Third\s+Party\s+Liability|Insurance)|Policy\s+End\s+Date)\b[\s\S]{0,180}?\bTo\s*:?[\s-]*([0-3]?\d)-([A-Za-z]{3,9})-(\d{4})/i,
  );
  if (periodTo) {
    const day = Number(periodTo[1]);
    const month = monthToNumber(periodTo[2]);
    const year = Number(periodTo[3]);
    if (year && month && day) return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // PRIORITY 4: Generic dd/mm/yyyy near expiry keywords
  const expDMY = t.match(
    /\b(Expiry|Expires|Valid\s*Upto|Policy\s*Expiry)\b[\s:]*([0-3]\d)\/([01]\d)\/(\d{4})/i
  );
  if (expDMY) return `${expDMY[4]}-${expDMY[3]}-${expDMY[2]}`;

  // PRIORITY 5: ACKO style: "Policy Expires 2024 10 August"
  // Captures: year, day, month
  const acko1 = t.match(
    /\bPolicy\s*Expires\b\s*[:\-]?\s*(\d{4})\s+([0-3]?\d)\s+([A-Za-z]{3,9})/i
  );
  if (acko1) {
    const year = Number(acko1[1]);
    const day = Number(acko1[2]);
    const month = monthToNumber(acko1[3]);
    if (year && month && day) return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // PRIORITY 6: "Policy Expires 10 August 2024"
  const acko2 = t.match(
    /\bPolicy\s*Expires\b\s*[:\-]?\s*([0-3]?\d)\s+([A-Za-z]{3,9})\s+(\d{4})/i
  );
  if (acko2) {
    const day = Number(acko2[1]);
    const month = monthToNumber(acko2[2]);
    const year = Number(acko2[3]);
    if (year && month && day) return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // PRIORITY 7: "Policy Expires August 10 2024" or "Policy Expires August 10, 2024"
  const acko3 = t.match(
    /\bPolicy\s*Expires\b\s*[:\-]?\s*([A-Za-z]{3,9})\s+([0-3]?\d)(?:,)?\s+(\d{4})/i
  );
  if (acko3) {
    const month = monthToNumber(acko3[1]);
    const day = Number(acko3[2]);
    const year = Number(acko3[3]);
    if (year && month && day) return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  return null;
}
// Name guess: MVP heuristic (later improve with LLM / better parsing)
export function extractPolicyholderName(text) {
  const raw = normalizeDate(text || "");

  // Helper: clean + validate
  const clean = (s) =>
    cutAtStopWords(s)
      .replace(/^(mr|mrs|ms)\.?\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();

  // 1) ACKO: "Car Owner Saswat Mishra" (stop at known markers)
  // More strict stop list directly in regex (best reliability)
  const acko = raw.match(
    /\bCar\s+Owner\b[:\s]*([A-Z][A-Za-z.\s]{2,80}?)(?=\s+(Insured\s*Value|Policy\s*Starts|Policy\s*Expires|Plan\s*Coverages|Reg\.?\s*no\.?|Reg\s*no|Policy\s*Number|$))/i
  );
  if (acko?.[1]) {
    const name = clean(acko[1]);
    if (looksLikePersonName(name)) return name;
  }

  // 2) SBI + many: "Dear Mr.Saswat Mishra"
  const dear = raw.match(
    /\bDear\b\s*(mr|mrs|ms)?\.?\s*([A-Z][A-Za-z.\s]{2,60}?)(?=[,.\n]|$)/i
  );
  if (dear?.[2]) {
    const name = clean(dear[2]);
    if (looksLikePersonName(name)) return name;
  }

  // 3) "Name : Mr Saswat Mishra" or "Name Mr Saswat Mishra"
  // Stop at label boundary so it doesn't absorb Address/Contact etc
  const nameInline = raw.match(
    /\bName\b\s*[:\-]?\s*(mr|mrs|ms)?\.?\s*([A-Z][A-Za-z.\s]{2,60}?)(?=\s+(Address|Email|Contact|Phone|Customer\s*ID|Intermediary|Branch|Policy|Period|$))/i
  );
  if (nameInline?.[2]) {
    const name = clean(nameInline[2]);
    if (looksLikePersonName(name)) return name;
  }

  // 4) "Insured Name: X"
  const insured = raw.match(
    /\bInsured\s+Name\b\s*[:\-]?\s*([A-Z][A-Za-z.\s]{2,60}?)(?=\s+(Address|Email|Contact|Phone|Customer\s*ID|Policy|Period|$))/i
  );
  if (insured?.[1]) {
    const name = clean(insured[1]);
    if (looksLikePersonName(name)) return name;
  }

  // 5) Line-aware fallback: "Name" on its own line then value next
  const lines = normalizeName(text || "");
  for (let i = 0; i < lines.length; i++) {
    if (/^name$/i.test(lines[i])) {
      const candidate = clean(lines[i + 1] || "");
      if (looksLikePersonName(candidate)) return candidate;
    }
  }

  return null;
}

function formatInrAmount(rawAmount) {
  const normalized = (rawAmount || "").replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  const hasDecimal = normalized.includes(".");
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: hasDecimal ? 2 : 0,
  }).format(value);
  return `INR ${formatted}`;
}

export function extractPolicyNumber(text) {
  const t = normalizeDate(text || "");
  const isLikelyPolicyNo = (v) => /[0-9]/.test(v) && v.length >= 8;

  const linePatterns = [
    /\bPolicy\s*\/\s*Certificate\s*(?:No\.?|Number)?\.?\s*[:\-]?\s*([A-Za-z0-9\/\-]{8,})\b/i,
    /\bPolicy\s*Certificate\s*(?:No\.?|Number)?\.?\s*[:\-]?\s*([A-Za-z0-9\/\-]{8,})\b/i,
    /\bPolicy\s*(?:No\.?|Number|#)\.?\s*[:\-]?\s*([A-Za-z0-9\/\-]{8,})\b/i,
  ];

  const lines = t
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    for (const pattern of linePatterns) {
      const match = line.match(pattern);
      if (!match?.[1]) continue;
      const candidate = match[1].trim().toUpperCase();
      if (isLikelyPolicyNo(candidate)) return candidate;
    }
  }

  const docWide = t.match(
    /\bPolicy\s*\/\s*Certificate\s*(?:No\.?|Number)?\b[\s:.\-]{0,20}([A-Za-z0-9\/\-]{8,})\b/i,
  );
  if (docWide?.[1]) {
    const candidate = docWide[1].trim().toUpperCase();
    if (isLikelyPolicyNo(candidate)) return candidate;
  }

  return null;
}

export function extractPolicyIdv(text) {
  const t = normalizeDate(text || "");
  const amountPattern =
    "(?:₹|INR|Rs\\.?|Rs)?\\s*([0-9][0-9,]*(?:\\.\\d{1,2})?)";

  const direct = t.match(
    new RegExp(
      `\\b(?:IDV|Insured\\s*Declared\\s*Value|Insured\\s*Value)\\b[^0-9₹]{0,40}${amountPattern}`,
      "i",
    ),
  );
  if (direct?.[1]) {
    const formatted = formatInrAmount(direct[1]);
    if (formatted) return formatted;
  }

  if (/\b(?:Act\s*Only|Liability\s*Only|Third\s*Party\s*Only)\b/i.test(t)) {
    return "Not Applicable";
  }

  return null;
}

export function extractRcOwnerName(rcText) {
  const lines = (rcText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const cleanOwnerName = (value) => {
    let name = (value || "")
      .replace(/\bS\s*\/\s*W\s*\/\s*D\b[\s\S]*$/i, "")
      .replace(/\b(?:Father|Husband|Address|Model|MFR|Regd|VHE\s*CL)\b[\s\S]*$/i, "")
      .replace(/[^A-Za-z.\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const parts = name.split(" ");
    if (parts.length >= 3 && parts[parts.length - 1].length === 1) {
      name = parts.slice(0, -1).join(" ");
    }

    return name || null;
  };

  const ownerLine =
    lines.find((l) => /OWNER\s*NAME|OWNERNAME/i.test(l)) ||
    lines.find((l) => /^NAME\s*[:\-]/i.test(l));
  if (ownerLine) {
    const value = ownerLine.includes(":")
      ? ownerLine.split(":").slice(1).join(":").trim()
      : ownerLine.replace(/OWNER\s*NAME|OWNERNAME|^NAME/i, "").trim();
    const name = cleanOwnerName(value);
    if (name && looksLikeRcOwnerName(name)) return name;
  }

  for (let i = 0; i < lines.length; i++) {
    if (!/^(?:OWNER\s*NAME|OWNERNAME|NAME)$/i.test(lines[i])) continue;

    const next = lines[i + 1] || "";
    const afterNext = lines[i + 2] || "";
    const candidates = [
      next.replace(/^[\s:.\-]+/, ""),
      `${next} ${afterNext}`.replace(/^[\s:.\-]+/, ""),
    ];

    for (const candidate of candidates) {
      const name = cleanOwnerName(candidate);
      if (name && looksLikeRcOwnerName(name)) return name;
    }
  }

  const flat = normalizeDate(rcText || "");
  const flatMatch = flat.match(
    /\b(?:OWNER\s*NAME|OWNERNAME|NAME)\b\s*[:\-]?\s*([A-Z][A-Za-z.\s]{2,80}?)(?=\s+(?:S\s*\/\s*W\s*\/\s*D|Father|Address|Model|MFR|Regd|VHE\s*CL|$))/i,
  );
  const flatName = cleanOwnerName(flatMatch?.[1] || "");
  return flatName && looksLikeRcOwnerName(flatName) ? flatName : null;
}

function pickLineValue(text, patterns) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    for (const p of patterns) {
      const m = line.match(p);
      if (!m) continue;
      const value = (m[1] || "")
        .replace(/^[\s:.\-]+/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (value) return value;
    }
  }
  return null;
}

function last4AlphaNum(value) {
  if (!value) return null;
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "");
  if (cleaned.length < 4) return null;
  return cleaned.slice(-4).toUpperCase();
}

function toTitleCase(value) {
  return (value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function cleanMakeModel(value) {
  if (!value) return null;

  let out = value
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();

  const stopMatch = out.match(
    /\b(Seating Capacity|Vehicle Make|RTO Location|Engine(?:\s*&)?\s*Chassis|Fuel|Manufacturing Year|Registration Number|ABOUT YOUR VEHICLE|COVERAGE DETAILS|Policy provides)\b/i,
  );
  if (stopMatch?.index && stopMatch.index > 0) {
    out = out.slice(0, stopMatch.index).trim();
  }

  const makeAnchor = out.match(
    /\b(Maruti|Suzuki|Hyundai|Honda|Tata|Mahindra|Toyota|Kia|Renault|Skoda|Volkswagen|Nissan|MG|Ford|BMW|Mercedes|Audi|Jeep)\b/i,
  );
  if (makeAnchor?.index && makeAnchor.index > 0) {
    out = out.slice(makeAnchor.index).trim();
  }

  out = out.replace(/[,:;\-]+$/, "").trim();

  if (out.length < 3 || out.length > 70) return null;
  if (!/[A-Za-z]/.test(out)) return null;
  if (/\b(coverage|policy|premium|registration|engine|chassis)\b/i.test(out))
    return null;

  return out;
}

function normalizeFuelValue(value) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v.includes("petrol")) return "Petrol";
  if (v.includes("diesel")) return "Diesel";
  if (v.includes("cng")) return "CNG";
  if (v.includes("lpg")) return "LPG";
  if (v.includes("electric")) return "Electric";
  if (v.includes("hybrid")) return "Hybrid";
  return null;
}

export function extractRcMakeModel(text) {
  const t = normalizeDate(text || "");

  // ACKO: "Car Hyundai i10 Variant Sportz AT"
  const ackoWithVariant = t.match(
    /\bCar\s+([A-Za-z0-9][A-Za-z0-9 .,&\-]{2,40}?)\s+Variant\s+([A-Za-z0-9][A-Za-z0-9 .,&\-]{1,35}?)\s+(?:Hypothecation|Registration year|Engine|Reg\.?\s*Authority)/i,
  );
  if (ackoWithVariant?.[1]) {
    const mm = cleanMakeModel(`${ackoWithVariant[1]} ${ackoWithVariant[2] || ""}`);
    if (mm) return mm;
  }

  // ACKO top summary: "Car Hyundai i10 Reg. no."
  const ackoTop = t.match(
    /\bCar\s+([A-Za-z0-9][A-Za-z0-9 .,&\-]{2,40}?)\s+Reg\.?\s*no\b/i,
  );
  if (ackoTop?.[1]) {
    const mm = cleanMakeModel(ackoTop[1]);
    if (mm) return mm;
  }

  // SBI table-style flattened extraction.
  const sbiTable = t.match(
    /\b([A-Za-z][A-Za-z0-9 .,&\-]{3,50}?)\s+Seating\s+Capacity\b/i,
  );
  if (sbiTable?.[1]) {
    const mm = cleanMakeModel(sbiTable[1]);
    if (mm) return mm;
  }

  const value = pickLineValue(text, [
    /\b(?:Maker'?s?\s+Class|Maker|Manufacturer)\b\s*[:\-]?\s*(.+)$/i,
    /\b(?:Model|Vehicle\s+Model)\b\s*[:\-]?\s*(.+)$/i,
  ]);
  return cleanMakeModel(value) || null;
}

export function extractRcFuel(text) {
  const t = normalizeDate(text || "");

  // ACKO: "Engine CC/ Fuel type 1197/Petrol"
  const ackoFuel = t.match(
    /\bEngine\s*CC\s*\/\s*Fuel\s*type\b\s*[:\-]?\s*(?:\d{3,5}\s*\/\s*)?([A-Za-z]{3,12})\b/i,
  );
  const ackoFuelValue = normalizeFuelValue(ackoFuel?.[1] || "");
  if (ackoFuelValue) return ackoFuelValue;

  // Generic "1234/Petrol" style
  const displacementFuel = t.match(
    /\b\d{3,5}\s*\/\s*(Petrol|Diesel|CNG|LPG|Electric|Hybrid)\b/i,
  );
  const displacementFuelValue = normalizeFuelValue(displacementFuel?.[1] || "");
  if (displacementFuelValue) return displacementFuelValue;

  // SBI flattened table near engine/chassis section.
  const sbiFuel = t.match(
    /\bEngine\s*&\s*Chassis\s*Number\b[\s\S]{0,140}\b(Petrol|Diesel|CNG|LPG|Electric|Hybrid)\b/i,
  );
  const sbiFuelValue = normalizeFuelValue(sbiFuel?.[1] || "");
  if (sbiFuelValue) return sbiFuelValue;

  const value = pickLineValue(text, [
    /\b(?:Fuel|Fuel\s*Type)\b\s*[:\-]?\s*(.+)$/i,
  ]);
  const directFuel = normalizeFuelValue(value || "");
  if (directFuel) return directFuel;

  // Fallback: pull a known fuel token from a noisy captured line.
  const fallback = normalizeFuelValue((value || "").replace(/\d+/g, " "));
  if (fallback) return fallback;

  return null;
}

export function extractRcYear(text) {
  const value = pickLineValue(text, [
    /\b(?:Mfg\.?\s*Date|Date\s+of\s+Manufacture|Manufacture\s+Year|Year\s+of\s+Mfg)\b\s*[:\-]?\s*(.+)$/i,
    /\b(?:Regd\s+Dt|Registration\s+Date|Invoice\s+Date)\b\s*[:\-]?\s*(.+)$/i,
  ]);
  if (!value) return null;
  const y = value.match(/\b(19|20)\d{2}\b/);
  return y ? y[0] : null;
}

export function extractRcColor(text) {
  const value = pickLineValue(text, [
    /\b(?:Colour|Color)\b\s*[:\-]?\s*(.+)$/i,
  ]);
  return value || null;
}

export function extractRcChassisLast4(text) {
  const value = pickLineValue(text, [
    /\b(?:Chassis(?:\s*No\.?)?|Chassis\s*Number)\b\s*[:\-]?\s*(.+)$/i,
    /\bCH\s*NO\b\s*[:\-]?\s*(.+)$/i,
  ]);
  return last4AlphaNum(value);
}

export function extractRcEngineLast4(text) {
  const value = pickLineValue(text, [
    /\b(?:Engine(?:\s*No\.?)?|Engine\s*Number)\b\s*[:\-]?\s*(.+)$/i,
    /\bE\s*SNO\b\s*[:\-]?\s*(.+)$/i,
  ]);
  return last4AlphaNum(value);
}

export function extractPolicyType(text) {
  const t = (text || "").toLowerCase().replace(/\s+/g, " ").trim();

  // Helper checks
  const has = (re) => re.test(t);

  const hasThirdParty =
    has(/\bthird\s*party\b/) ||
    has(/\btp\s*(only)?\b/) ||
    has(/\bliability\b/) ||
    has(/\bsection\s*ii\b/); // many docs label TP as Section II

  const hasOwnDamage =
    has(/\bown\s*damage\b/) ||
    has(/\bod\s*(only)?\b/) ||
    has(/\bsection\s*i\b/) || // many docs label OD as Section I
    has(/\bdamage to (your|the) vehicle\b/);

  const hasComprehensiveCue =
    has(/\bcomprehensive\b/) ||
    has(/\bpackage\b/) ||
    has(/\bpackage policy\b/) ||
    has(/\bmotor package\b/) ||
    has(/\bprivate car package\b/) ||
    has(/\btwo[-\s]*wheeler package\b/) ||
    has(/\bstandalone own damage\b/); // OD implies not TP-only

  const hasActOnlyCue =
    has(/\bact only\b/) ||
    has(/\bliability only\b/) ||
    has(/\bthird party only\b/) ||
    has(/\btp only\b/) ||
    has(/\bliability policy\b/) ||
    has(/\bstatutory liability\b/);

  // --- Insurer-specific strong phrases ---
  // ACKO
  if (has(/\bcomprehensive plan\b/)) return "Comprehensive";
  if (has(/\bthird party plan\b/)) return "Act Only";

  // ICICI Lombard
  // Often uses "Package Policy", "Liability Only Policy", "Standalone Own Damage"
  if (has(/\bicici\b.*\bpackage\b/) || has(/\bpackage policy\b.*\bicici\b/))
    return "Comprehensive";
  if (
    has(/\bicici\b.*\bliability only\b/) ||
    has(/\bliability only\b.*\bicici\b/)
  )
    return "Act Only";
  if (has(/\bstandalone own damage\b/) && has(/\bicici\b/))
    return "Comprehensive";

  // HDFC ERGO
  if (has(/\bhdfc\b.*\bpackage\b/) || has(/\bhdfc ergo\b.*\bpackage\b/))
    return "Comprehensive";
  if (
    has(/\bhdfc\b.*\bliability only\b/) ||
    has(/\bhdfc ergo\b.*\bliability only\b/)
  )
    return "Act Only";
  if (has(/\bstandalone own damage\b/) && has(/\bhdfc\b|\bhdfc ergo\b/))
    return "Comprehensive";

  // Tata AIG
  if (has(/\btata\b.*\bpackage\b/) || has(/\btata aig\b.*\bpackage\b/))
    return "Comprehensive";
  if (
    has(/\btata\b.*\bliability only\b/) ||
    has(/\btata aig\b.*\bliability only\b/)
  )
    return "Act Only";
  if (has(/\bstandalone own damage\b/) && has(/\btata\b|\btata aig\b/))
    return "Comprehensive";

  // --- General decision logic (tie-breakers) ---
  // If Own Damage is present, it's not TP-only.
  if (hasOwnDamage) return "Comprehensive";

  // Act-only cues
  if (hasActOnlyCue) return "Act Only";

  // Comprehensive cues
  if (hasComprehensiveCue) return "Comprehensive";

  // If we only see third party-ish terms and no OD cues -> likely TP only
  if (hasThirdParty && !hasOwnDamage) return "Act Only";

  return "Unknown";
}

export function extractInsurer(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("sbi general")) return "SBI General";
  if (t.includes("acko")) return "ACKO";
  if (t.includes("icici lombard")) return "ICICI Lombard";
  if (t.includes("hdfc ergo")) return "HDFC ERGO";
  if (t.includes("bajaj allianz")) return "Bajaj Allianz";
  if (t.includes("tata aig")) return "Tata AIG";
  return "Unknown";
}

function normalizeDlText(text) {
  return (text || "").replace(/\r/g, "\n").replace(/\u00a0/g, " "); // non-breaking spaces
}
function normalizeKeepLines(s) {
  return (s || "")
    .replace(/\u00a0/g, " ")
    .replace(/[|]/g, " ")
    .replace(/\r/g, "\n");
}

function normalizeFlat(s) {
  return normalizeKeepLines(s)
    .replace(/[ \t]+/g, " ")
    .trim();
}

function dlLines(text) {
  return normalizeDlText(text)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function looksLikeDobOrDate(s) {
  return /^([0-3]?\d)[\/\-]([01]?\d)[\/\-](\d{4})$/.test((s || "").trim());
}

function isLikelyNameLine(s) {
  if (!s) return false;
  const x = s.trim();

  if (x.length < 3 || x.length > 60) return false;
  if (/[0-9@]/.test(x)) return false;

  // reject common DL keywords/noise
  if (
    /dl|licen|license|licence|doi|dob|valid|bg|address|form|union|state|issued|number|vehicle|class|signature/i.test(
      x
    )
  )
    return false;

  // mostly letters/spaces/dots
  if (!/^[A-Za-z.\s]+$/.test(x)) return false;

  // needs at least first + last name
  if (!x.includes(" ")) return false;

  return true;
}

function startCaseName(s) {
  return (s || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function extractDlHolderName(text) {
  const rawLines = normalizeKeepLines(text);
  const lines = rawLines
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const flat = normalizeFlat(text);

  const looksLikeDob = (s) =>
    /^\s*[0-3]?\d[\/\-][01]?\d[\/\-]\d{4}\s*$/.test(s || "");

  function isLikelyNameLine(s) {
    if (!s) return false;
    const x = s.trim();

    if (x.length < 3 || x.length > 60) return false;
    if (/[0-9@]/.test(x)) return false;

    // reject common DL keywords / noise
    if (
      /dl|licen|license|licence|doi|dob|valid|bg|address|form|union|state|issued|number|vehicle|class|signature|authority/i.test(
        x
      )
    )
      return false;

    // Must be mostly letters/spaces
    if (!/^[A-Za-z.\s]+$/.test(x)) return false;

    // must have at least one space (first + last)
    if (!x.includes(" ")) return false;

    return true;
  }

  // ✅ PRIORITY A (Odisha): "DLNUMBER" then next line like ": BABA BISWANATH MISHRA"
  // Example:
  // OR02K19990011005
  // : BABA BISWANATH MISHRA
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^[A-Z]{2}\d{2}[A-Z]?\d{11,}$/i.test(lines[i].replace(/\s+/g, ""))) {
      const next = lines[i + 1];
      const m = next.match(/^\:\s*([A-Za-z.\s]{3,60})$/);
      if (m?.[1]) {
        const cand = m[1].trim();
        if (isLikelyNameLine(cand)) return startCaseName(cand);
      }
    }
  }

  // ✅ PRIORITY B (Karnataka): D.O.B then next line is name and next line is DOB date
  for (let i = 0; i < lines.length - 2; i++) {
    if (/^d\.?o\.?b\.?$/i.test(lines[i]) || /^d\.?o\.?b\b/i.test(lines[i])) {
      const cand = lines[i + 1];
      const next = lines[i + 2];
      if (isLikelyNameLine(cand) && looksLikeDob(next)) {
        return startCaseName(cand);
      }
    }
  }

  // ✅ PRIORITY C: Inline "Name : <value>" but STOP before S/D/W (so we don't pick father name)
  // (Some PDFs have it inline)
  const mInline = flat.match(
    /\bName\b\s*[:\-]?\s*([A-Z][A-Za-z.\s]{2,60}?)(?=\s+(S\/D\/W|S\/O|D\/O|W\/O|DOB|DOI|DL|Licence|License|$))/i
  );
  if (mInline?.[1]) {
    const cand = mInline[1].trim();
    if (isLikelyNameLine(cand)) return startCaseName(cand);
  }

  // ✅ FINAL fallback: first good name that is followed by a DOB-looking date
  for (let i = 0; i < lines.length - 1; i++) {
    const cand = lines[i];
    if (isLikelyNameLine(cand) && looksLikeDob(lines[i + 1])) {
      return startCaseName(cand);
    }
  }

  return null;
}

export function extractDlValidUptoISO(text) {
  const flat = normalizeFlat(text);

  // 1) Keyword based (VALID TILL / VALID UPTO) with dd/mm/yyyy or dd-mm-yyyy
  const kw = flat.match(
    /\bValid\s*(?:Till|Upto|Up\s*to)\b\s*[:\-]?\s*([0-3]?\d)[\/\-]([01]?\d)[\/\-](\d{4})/i
  );
  if (kw) return `${kw[3]}-${pad2(kw[2])}-${pad2(kw[1])}`;

  // 2) Fallback: collect all dates and pick the latest (max)
  const all = [...flat.matchAll(/\b([0-3]?\d)[\/\-]([01]?\d)[\/\-](\d{4})\b/g)];
  if (!all.length) return null;

  let best = null;
  let bestTime = -Infinity;

  for (const m of all) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) continue;

    const t = new Date(`${y}-${pad2(mo)}-${pad2(d)}T00:00:00`).getTime();
    if (!Number.isNaN(t) && t > bestTime) {
      bestTime = t;
      best = `${y}-${pad2(mo)}-${pad2(d)}`;
    }
  }

  return best;
}
