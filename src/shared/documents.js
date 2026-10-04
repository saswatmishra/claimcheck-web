export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export function validateDocumentFile(file) {
  if (!DOCUMENT_MIME_TYPES.includes(file.type || file.mimetype)) {
    return "Choose a PDF, JPG, PNG, or WebP file.";
  }
  if (file.size === 0) return "This file is empty. Choose another copy.";
  if (file.size > MAX_FILE_BYTES) return "This file is too large. Use a file up to 8 MB.";
  return null;
}

// Reject dates such as February 31 that JavaScript silently rolls into March.
export function validDateISO(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

export function calendarDaysBetween(start, end) {
  if (!validDateISO(start) || !validDateISO(end)) return null;
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;
}

export function normalizeVehicleNumber(value) {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase().replace(/[\s-]/g, "");
  return /^(?:[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}|\d{2}BH\d{4}[A-Z]{1,2})$/.test(normalized)
    ? normalized
    : null;
}

export function normalizePersonName(value) {
  return (value ?? "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/^(?:MR|MRS|MS|DR|SHRI|SMT)\.?\s+/, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}
