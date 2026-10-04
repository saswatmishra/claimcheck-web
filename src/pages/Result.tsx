import { useLocation, useNavigate } from "react-router-dom";
import type { AnalysisResult as AnalysisData } from "../types/analysis";
import { loadLastResult } from "../services/storage";
import { useSavedVehicles } from "../hooks/use-saved-vehicles";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useRef } from "react";
import ShareCard from "../components/ShareCard";
import { APP_CONFIG, getAppUrl } from "../config";
import AnalysisResult from "../components/AnalysisResult";

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as { result?: AnalysisData } | undefined;
  const result = state?.result ?? loadLastResult();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { save } = useSavedVehicles();

  if (!result) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-semibold text-slate-900">No result found</h2>
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
    analysisResult.extracted?.rc?.vehicleNumber ||
    analysisResult.extracted?.policy?.vehicleNumber ||
    "Unknown";
  const insurer = analysisResult.extracted?.policy?.insurer || "Unknown";
  const expiryIso = analysisResult.extracted?.policy?.expiryIso || null;
  const policyType = analysisResult.extracted?.policy?.policyType || "Unknown";

  function maskVehicle(v?: string) {
    if (!v || v === "Unknown") return "—";
    const normalized = v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (!normalized) return "—";
    return `${normalized.slice(0, 4)}****`;
  }

  function buildShareText(r: AnalysisData) {
    const risk = (r?.risk ?? "AMBER").toUpperCase();

    const riskText =
      risk === "RED" ? "High Risk" : risk === "AMBER" ? "Medium Risk" : "Low Risk";

    const maskedVehicle = maskVehicle(
      r.extracted?.rc?.vehicleNumber || r.extracted?.policy?.vehicleNumber || "Unknown",
    );

    const reason =
      r.findings?.[0]?.title?.trim() || r.summary?.trim() || "No major issues detected";

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

  async function generateCardCanvas() {
    if (!cardRef.current) return;
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(cardRef.current, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
  }

  async function generateCardBlob() {
    const canvas = await generateCardCanvas();
    if (!canvas) return null;

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

  async function generateCardPdfBlob() {
    const { jsPDF } = await import("jspdf");
    const canvas = await generateCardCanvas();
    if (!canvas) return null;

    const dataUrl = canvas.toDataURL("image/png");
    const ratio = canvas.height / canvas.width;
    const pdfWidth = 210;
    const pdfHeight = pdfWidth * ratio;
    const pdf = new jsPDF({
      orientation: pdfHeight > pdfWidth ? "portrait" : "landscape",
      unit: "mm",
      format: [pdfWidth, pdfHeight],
    });
    pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
    return pdf.output("blob");
  }

  function downloadPdfBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function shareResultAsPdf() {
    const pdfBlob = await generateCardPdfBlob();
    if (!pdfBlob) {
      toast.error("Couldn’t generate PDF.");
      return;
    }

    const filename = `claimcheck-${(analysisResult.risk ?? "AMBER").toLowerCase()}-result.pdf`;
    const file = new File([pdfBlob], filename, { type: "application/pdf" });
    const supportsNativeShare = typeof navigator.share === "function";

    if (supportsNativeShare) {
      try {
        const canShareFiles =
          typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] });

        if (canShareFiles) {
          await navigator.share({
            files: [file],
            title: "ClaimCheck Report",
            text: "Sharing my ClaimCheck insurance health report PDF.",
          });
          return;
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    downloadPdfBlob(pdfBlob, filename);
    toast.info("PDF downloaded. Share it as an attachment.");
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
          typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] });

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
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    try {
      downloadCardBlob(blob);
      window.location.href = fallbackUrl;
      toast.info("Card downloaded. If WhatsApp opens without the image, attach the card.");
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
      <div className="max-w-4xl mx-auto px-6 py-12">
        <AnalysisResult data={analysisResult} />

        <div className="mt-10">
          <h3 className="text-lg font-semibold text-slate-900">Shareable result card</h3>
          <p className="text-sm text-slate-600 mt-1">Share this card directly to WhatsApp.</p>

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
                try {
                  save({
                    regNumber: vehicleNo,
                    nickname: "",
                    analysis: analysisResult,
                    expiryIso,
                    policyType,
                    insurer,
                  });
                  toast.success("Vehicle saved in this browser.");
                } catch {
                  toast.error("Couldn’t save in this browser. Download the report instead.");
                }
              }
            }}
            className="border px-5 py-3 rounded-lg"
          >
            Save this vehicle
          </button>

          <button onClick={() => window.print()} className="border px-5 py-3 rounded-lg">
            Print / Save
          </button>

          <button onClick={shareCardOnWhatsApp} className="border px-5 py-3 rounded-lg">
            Share on WhatsApp
          </button>

          <button
            onClick={shareResultAsPdf}
            className="border px-5 py-3 rounded-lg hover:bg-slate-50"
          >
            Share PDF
          </button>
        </div>
      </div>
    </div>
  );
}
