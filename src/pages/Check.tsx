import { useState } from "react";
import { FiAlertTriangle, FiLoader, FiShield, FiStar } from "react-icons/fi";
import AnalysisResult from "../components/AnalysisResult";
import FileDropzone from "../components/FileDropzone";
import { APP_CONFIG } from "../config";
import type { AnalysisResult as AnalysisData } from "../types/analysis";

async function analyzeViaApi(rcFile: File, policyFile: File): Promise<AnalysisData> {
  const formData = new FormData();
  formData.append("rc", rcFile);
  formData.append("policy", policyFile);

  const res = await fetch(`${APP_CONFIG.apiBaseUrl}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Analysis failed (${res.status}). ${txt}`);
  }

  return (await res.json()) as AnalysisData;
}

export default function Check() {
  const [rcFile, setRcFile] = useState<File | null>(null);
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisData | null>(null);

  const canAnalyze = !!rcFile && !!policyFile && !loading;

  const handleAnalyze = async () => {
    if (!rcFile || !policyFile) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeViaApi(rcFile, policyFile);
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setRcFile(null);
    setPolicyFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <section className="mx-auto mb-10 max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            <FiStar className="h-3.5 w-3.5 text-slate-900" />
            AI-powered verification
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Verify your RC & Insurance
            <span className="block text-slate-700">in seconds.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Upload your Registration Certificate and Insurance Policy. We detect
            mismatches, highlight risks, and tell you exactly how to fix them.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <FiShield className="h-5 w-5 text-slate-900" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">ClaimCheck</p>
              <p className="text-[11px] text-slate-500">Document Risk Analysis</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FileDropzone
              label="Registration Certificate (RC)"
              description="Vehicle registration document issued by RTO"
              file={rcFile}
              onFileChange={setRcFile}
            />
            <FileDropzone
              label="Insurance Policy"
              description="Active insurance policy document"
              file={policyFile}
              onFileChange={setPolicyFile}
            />
          </div>

          <div className="mt-6 flex flex-col items-stretch gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {canAnalyze
                ? "Both documents ready. Click Analyze to begin."
                : "Upload both documents to enable analysis."}
            </p>
            <div className="flex gap-2">
              {(rcFile || policyFile || result) && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <FiLoader className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <FiStar className="h-4 w-4" />
                    Analyze Documents
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Unable to analyze</p>
              <p className="mt-0.5 text-red-700">{error}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="mt-8 space-y-4">
            <div className="h-32 animate-pulse rounded-2xl bg-white" />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-64 animate-pulse rounded-2xl bg-white" />
              <div className="h-64 animate-pulse rounded-2xl bg-white" />
            </div>
          </div>
        )}

        {result && !loading && (
          <section className="mt-10">
            <AnalysisResult data={result} />
          </section>
        )}
      </main>
    </div>
  );
}
