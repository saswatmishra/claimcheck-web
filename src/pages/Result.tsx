import { useLocation, useNavigate } from "react-router-dom";
import RiskBadge, { severityClasses } from "../components/RiskBadge";
import type { AnalysisResult } from "../types/analysis";
import { loadLastResult } from "../services/storage";
import { saveVehicle } from "../services/vehicles";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useMemo } from "react";
import { useRef } from "react";
import html2canvas from "html2canvas";
import ShareCard from "../components/ShareCard";
import { APP_CONFIG, getAppUrl } from "../config";
import {
  FiAlertOctagon,
  FiCheckSquare,
  FiTool,
} from "react-icons/fi";

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as { result?: AnalysisResult } | undefined;
  const result = state?.result ?? loadLastResult();
  const checked = useMemo(() => {
    return result?.checked ?? [];
  }, [result]);
  const cardRef = useRef<HTMLDivElement | null>(null);

  if (!result) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-slate-900">
            No result found
          </h2>
          <p className="text-slate-600 mt-2">Please run a check again.</p>
          <button
            className="mt-6 bg-slate-900 text-white px-5 py-3 rounded-lg"
            onClick={() => navigate("/check")}
          >
            Go to Check
          </button>
        </div>
      </div>
    );
  }
  const analysisResult = result;

  const vehicleNo =
    (analysisResult?.extracted as any)?.rc?.vehicleNumber ||
    (analysisResult?.extracted as any)?.policy?.vehicleNumber ||
    "Unknown";
  const insurer = analysisResult?.extracted?.policy?.insurer || "Unknown";
  const expiryIso = analysisResult?.extracted?.policy?.expiryIso || null;
  const policyType = analysisResult?.extracted?.policy?.policyType || "Unknown";
  const risk = (analysisResult.risk ?? "AMBER") as "GREEN" | "AMBER" | "RED";
  const summary = analysisResult.summary ?? "Result generated.";
  const findings = analysisResult.findings ?? [];
  const fixes = analysisResult.fixes ?? [];

  const riskStyles = {
    RED: "bg-red-50 border-red-200 text-red-800",
    AMBER: "bg-amber-50 border-amber-200 text-amber-900",
    GREEN: "bg-green-50 border-green-200 text-green-900",
  } as const;

  const riskTitle = {
    RED: "High Risk",
    AMBER: "Medium Risk",
    GREEN: "Low Risk",
  } as const;

  function maskVehicle(v?: string) {
    if (!v || v === "Unknown") return "—";
    const normalized = v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (!normalized) return "—";
    return `${normalized.slice(0, 4)}****`;
  }

  function buildShareText(r: AnalysisResult) {
    const risk = (r?.risk ?? "AMBER").toUpperCase();

    const riskText =
      risk === "RED"
        ? "High Risk"
        : risk === "AMBER"
          ? "Medium Risk"
          : "Low Risk";

    const maskedVehicle = maskVehicle(
      (r?.extracted as any)?.rc?.vehicleNumber ||
        (r?.extracted as any)?.policy?.vehicleNumber ||
        "Unknown",
    );

    const reason =
      r?.findings?.[0]?.title?.trim() ||
      r?.summary?.trim() ||
      "No major issues detected";

    const firstLineReason = reason.split("\n")[0].trim();

    return [
      "*This is my insurance health report*",
      "",
      `*Vehicle:* ${maskedVehicle}`,
      `*Risk:* ${riskText}`,
      `*Reason:* ${firstLineReason}`,
      "",
      `Check yours at ${APP_CONFIG.appName}`,
      getAppUrl("/"),
    ].join("\n");
  }

  async function generateCardBlob() {
    if (!cardRef.current) return;

    const canvas = await html2canvas(cardRef.current, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/png");
    });
  }

  function downloadCardBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claimcheck-${(analysisResult.risk ?? "AMBER").toLowerCase()}-result.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadCardImage() {
    const blob = await generateCardBlob();
    if (!blob) {
      toast.error("Couldn’t generate result card image.");
      return;
    }
    downloadCardBlob(blob);
  }

  async function shareCardOnWhatsApp() {
    const text = buildShareText(analysisResult);
    const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(
      `${text}\n\n(Attach the downloaded result card image)`,
    )}`;
    const supportsNativeShare = typeof navigator.share === "function";

    const blob = await generateCardBlob();
    if (!blob) {
      toast.error("Couldn’t generate result card image.");
      return;
    }

    const filename = `claimcheck-${(analysisResult.risk ?? "AMBER").toLowerCase()}-result.png`;
    const file = new File([blob], filename, { type: "image/png" });

    if (supportsNativeShare) {
      try {
        const canShareFiles =
          typeof navigator.canShare !== "function" ||
          navigator.canShare({ files: [file] });

        if (canShareFiles) {
          await navigator.share({
            files: [file],
            text,
            title: "ClaimCheck Result Card",
          });
          return;
        }

        await navigator.share({
          text,
          title: "ClaimCheck Result Card",
        });
        downloadCardBlob(blob);
        toast.info("Caption shared. Attach the downloaded result card in WhatsApp.");
        return;
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        // Fall through to direct WhatsApp navigation.
      }
    }

    try {
      downloadCardBlob(blob);
      window.location.href = fallbackUrl;
      toast.info(
        "Card downloaded. If WhatsApp opens without the image, attach the downloaded card."
      );
      return;
    } catch {
      try {
        window.open(fallbackUrl, "_self");
        return;
      } catch {
        toast.error("Couldn’t open WhatsApp from this browser.");
      }
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Colored banner */}
        <div className={`border rounded-xl p-4 ${riskStyles[risk]}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">{riskTitle[risk]}</p>
              <p className="text-sm mt-1">{summary}</p>
            </div>
            <RiskBadge risk={risk} />
          </div>
        </div>

        {/* Header */}
        <div className="mt-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Your ClaimCheck Result
          </h2>
          <p className="text-slate-600 mt-1">
            Document consistency + claim-readiness signals
          </p>
        </div>

        {/* What we checked */}
        <div className="mt-6 border rounded-lg p-4 bg-slate-50">
          <h3 className="font-semibold text-slate-900">What we checked</h3>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {checked.length === 0 ? (
              <div className="text-sm text-slate-600">
                No extracted fields yet.
              </div>
            ) : (
              checked.map((item, idx) => {
                return (
                  <div key={idx} className="bg-white border rounded-lg p-3">
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="text-slate-900 font-medium mt-1">
                      {item.value}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Findings */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                <FiAlertOctagon className="h-4 w-4 text-slate-900" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Findings</h3>
              <span className="ml-auto text-xs text-slate-500">
                {findings.length} issues
              </span>
            </div>

            {findings.length > 0 ? (
              <ul className="space-y-3">
                {findings.map((f) => (
                  <li
                    key={f.code}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100/70"
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-3">
                      <h4 className="font-medium text-slate-900">{f.title}</h4>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClasses(f.severity)}`}
                        >
                          {f.severity}
                        </span>
                        <span className="text-xs text-slate-400">{f.code}</span>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">{f.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">No findings reported.</p>
            )}
          </div>

          {/* Fixes */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                <FiTool className="h-4 w-4 text-slate-900" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Recommended Fixes
              </h3>
            </div>

            {fixes.length > 0 ? (
              <ul className="space-y-4">
                {fixes.map((fix, idx) => (
                  <li key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    {fix.title ? (
                      <h4 className="mb-2 font-medium text-slate-900">{fix.title}</h4>
                    ) : null}
                    <ol className="space-y-2">
                      {fix.steps.map((step, j) => (
                        <li key={j} className="flex gap-3 text-sm text-slate-600">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900/10 text-[11px] font-semibold text-slate-900">
                            {j + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FiCheckSquare className="h-4 w-4" />
                No fixes required.
              </div>
            )}
          </div>
        </div>
        <div className="mt-10">
          <h3 className="text-lg font-semibold text-slate-900">
            Shareable result card
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Share this card directly to WhatsApp.
          </p>

          <div className="mt-4 flex justify-center">
            <div ref={cardRef}>
              <ShareCard result={analysisResult} />
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/check")}
            className="bg-slate-900 text-white px-5 py-3 rounded-lg"
          >
            Run Another Check
          </button>

          <button
            onClick={() => {
              if (vehicleNo === "Unknown") {
                toast.error("Couldn’t detect vehicle number to save.");
              } else {
                saveVehicle({
                  vehicleNo,
                  analysis: analysisResult,
                  expiryIso,
                  policyType,
                  insurer,
                  savedAt: new Date().toISOString(),
                });
                toast.success("Vehicle saved!");
              }
            }}
            className="border px-5 py-3 rounded-lg"
          >
            Save this vehicle
          </button>

          <button
            onClick={() => window.print()}
            className="border px-5 py-3 rounded-lg"
          >
            Print / Save
          </button>

          <button
            onClick={shareCardOnWhatsApp}
            className="border px-5 py-3 rounded-lg"
          >
            Share on WhatsApp
          </button>
          <button
            onClick={downloadCardImage}
            className="border px-5 py-3 rounded-lg hover:bg-slate-50"
          >
            Download Result Card
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-6">
          Disclaimer: ClaimCheck provides a document consistency check and
          general guidance. Claims can fail for many reasons (late intimation,
          license issues, policy lapses, etc.). Final decisions depend on
          insurer terms and verification.
        </p>
      </div>
      <ToastContainer />
    </div>
  );
}
