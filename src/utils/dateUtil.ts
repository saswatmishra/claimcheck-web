export function  formatDate(expiryIso: string | null) {
  if (!expiryIso) return "—";
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
  const exp = new Date(`${expiryIso}T00:00:00`);
  if (Number.isNaN(exp.getTime())) return null;

  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const diffMs = exp.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}