import { APP_CONFIG } from "../config";
import type { AnalysisResult } from "../types/analysis";
import { isAnalysisResult } from "../shared/report.js";

export async function analyzeDocuments(
  rc: File,
  policy: File,
  dl: File | null,
  signal: AbortSignal,
): Promise<AnalysisResult> {
  const body = new FormData();
  body.append("rc", rc);
  body.append("policy", policy);
  if (dl) body.append("dl", dl);

  let response: Response;
  try {
    response = await fetch(`${APP_CONFIG.apiBaseUrl}/analyze`, { method: "POST", body, signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Couldn’t reach ClaimCheck. Check your connection and try again. Your selected files are still here.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // Never display raw proxy HTML or internal server details to the user.
    const message = response.status < 500 && typeof data?.error === "string"
      ? data.error
      : "ClaimCheck couldn’t finish this check. Please try again in a moment.";
    throw new Error(message);
  }
  if (!isAnalysisResult(data)) {
    throw new Error("We received an incomplete report. Please try the check again.");
  }
  return data;
}
