import { useLocation, useNavigate } from "react-router-dom";
import RiskBadge from "../components/RiskBadge";
import type { AnalysisResult } from "../types/analysis";
import { loadLastResult } from "../services/storage";
import { saveVehicle } from "../services/vehicles";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect, useMemo } from "react";
import { useRef } from "react";
import html2canvas from "html2canvas";
import ShareCard from "../components/ShareCard";

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as { result?: AnalysisResult } | undefined;
  const result = state?.result ?? loadLastResult();
  const vehicleNo =
    (result?.extracted as any)?.rc?.vehicleNumber ||
    (result?.extracted as any)?.policy?.vehicleNumber ||
    "Unknown";

  const insurer = result?.extracted?.policy?.insurer || "Unknown";
  const expiryIso = result?.extracted?.policy?.expiryIso || null;
  const policyType = result?.extracted?.policy?.policyType || "Unknown";
  const risk = (result.risk ?? "AMBER") as "GREEN" | "AMBER" | "RED";
  const summary = result.summary ?? "Result generated.";

  const findings = result.findings ?? [];
  const fixes = result.fixes ?? [];
  const checked = useMemo(() => {
    return result?.checked ?? [];
  }, [result]);
  const cardRef = useRef<HTMLDivElement | null>(null);

  async function downloadCardImage() {
    if (!cardRef.current) return;

    const canvas = await html2canvas(cardRef.current, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `claimcheck-${(
        result.risk ?? "AMBER"
      ).toLowerCase()}-result.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  useEffect(() => {
    const renewalRiskItem = checked.find(
      (item) => item.label === "Renewal Risk" && item.value === "RED"
    );

    if (renewalRiskItem) {
      toast.error(
        "Policy is expired. Renew immediately to avoid fines and claim risk. "
      );
    }
  }, [checked]);

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

  function buildShareText(r: AnalysisResult) {
    const risk = (r?.risk ?? "AMBER").toUpperCase();

    const riskText =
      risk === "RED"
        ? "HIGH RISK (RED)"
        : risk === "AMBER"
        ? "MEDIUM RISK (AMBER)"
        : "LOW RISK (GREEN)";

    const reason = r?.summary?.trim()
      ? r.summary.trim()
      : r?.findings?.[0]?.title ?? "No major issues detected";

    const steps = Array.isArray(r?.fixes?.[0]?.steps) ? r.fixes![0].steps : [];

    const stepsBlock =
      steps.length > 0
        ? steps.map((s) => `- ${s}`).join("\n")
        : "- Keep documents updated";

    return [
      "*ClaimCheck Result*",
      "",
      `*Risk:* ${riskText}`,
      `*Reason:* ${reason}`,
      "",
      "*Next steps*",
      stepsBlock,
      "",
      "_Run your own check:_",
      "http://localhost:5173",
    ].join("\n");
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

        {/* Why this rating */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-slate-900">
            Why this rating?
          </h3>
          <div className="mt-3 space-y-3">
            {findings.length === 0 ? (
              <div className="border rounded-lg p-4 bg-slate-50 text-slate-700">
                No major issues detected from the provided info.
              </div>
            ) : (
              findings.map((f) => (
                <div key={f.code} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900">{f.title}</p>
                    <span className="text-xs text-slate-500">{f.code}</span>
                  </div>
                  <p className="text-slate-600 mt-2">{f.detail}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Fix steps */}
        <div className="mt-10">
          <h3 className="text-lg font-semibold text-slate-900">How to fix</h3>
          <div className="mt-3 space-y-4">
            {fixes.length === 0 ? (
              <div className="border rounded-lg p-4 bg-slate-50 text-slate-700">
                Next steps: OCR extraction will run here next.
              </div>
            ) : (
              fixes.map((fix, idx) => (
                <div key={idx} className="border rounded-lg p-4 bg-slate-50">
                  <p className="font-medium text-slate-900">{fix.title}</p>
                  <ol className="list-decimal ml-5 mt-2 text-slate-700 space-y-1">
                    {fix.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="mt-10">
          <h3 className="text-lg font-semibold text-slate-900">
            Shareable result card
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Download this card and share it on WhatsApp.
          </p>

          <div className="mt-4 flex justify-center">
            <div ref={cardRef}>
              <ShareCard result={result} />
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
                  expiryIso,
                  policyType,
                  insurer,
                  savedAt: new Date().toISOString(),
                });
                toast.success("Vehicle save initiated!");
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
            onClick={() => {
              const text = buildShareText(result);
              const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
              window.open(url, "_blank");
            }}
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
