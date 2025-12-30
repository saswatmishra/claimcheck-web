import type { AnalysisResult } from "../types/analysis";

const KEY = "claimcheck:lastResult";

function slimForStorage(result: AnalysisResult): AnalysisResult {
  // Deep clone, then remove big fields if present
  const copy: any = structuredClone(result);

  // If you have extracted/rawText in result, remove it
  if (copy.extracted?.rc?.rawText) delete copy.extracted.rc.rawText;
  if (copy.extracted?.policy?.rawText) delete copy.extracted.policy.rawText;

  // If extracted exists but is still heavy, you can also drop extracted entirely:
  // delete copy.extracted;

  return copy as AnalysisResult;
}

export function saveLastResult(result: AnalysisResult) {
  try {
    const slim = slimForStorage(result);
    localStorage.setItem(KEY, JSON.stringify(slim));
  } catch (e) {
    // Don’t block navigation if storage fails
    console.warn("Could not save result to localStorage:", e);
  }
}

export function loadLastResult(): AnalysisResult | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AnalysisResult;
  } catch {
    return null;
  }
}

export function clearLastResult() {
  localStorage.removeItem(KEY);
}
