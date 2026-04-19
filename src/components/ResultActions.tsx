import { useState } from "react";
import { FiBookmark, FiDownload, FiFileText, FiLoader, FiShare2 } from "react-icons/fi";
import { downloadPng, elementToPdfBlob, shareOnWhatsApp, triggerDownload } from "../lib/export-card";
import type { AnalysisResult as AnalysisData } from "../types/analysis";

interface ResultActionsProps {
  data: AnalysisData;
  cardRef: React.RefObject<HTMLDivElement | null>;
  onSave: () => void;
  saved?: boolean;
  filenameBase?: string;
}

function buildShareText(data: AnalysisData) {
  const riskLabel =
    data.risk?.toUpperCase() === "RED"
      ? "HIGH RISK"
      : data.risk?.toUpperCase() === "AMBER"
        ? "MEDIUM RISK"
        : "LOW RISK";
  const findings = data.findings?.length ?? 0;
  return [
    "*ClaimCheck Report*",
    "",
    riskLabel,
    data.summary,
    findings > 0 ? `${findings} finding${findings === 1 ? "" : "s"} detected.` : "",
    "",
    "Verify your RC & Insurance: https://claimcheck.co.in",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function ResultActions({
  data,
  cardRef,
  onSave,
  saved,
  filenameBase = "claimcheck-report",
}: ResultActionsProps) {
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);

  const handlePng = async () => {
    if (!cardRef.current) return;
    setBusy("png");
    try {
      await downloadPng(cardRef.current, `${filenameBase}.png`);
    } finally {
      setBusy(null);
    }
  };

  const handlePdf = async () => {
    if (!cardRef.current) return;
    setBusy("pdf");
    try {
      const filename = `${filenameBase}.pdf`;
      const blob = await elementToPdfBlob(cardRef.current);
      const file = new File([blob], filename, { type: "application/pdf" });
      const supportsNativeShare = typeof navigator.share === "function";

      if (supportsNativeShare) {
        try {
          const canShareFiles =
            typeof navigator.canShare !== "function" ||
            navigator.canShare({ files: [file] });

          if (canShareFiles) {
            await navigator.share({
              files: [file],
              title: "ClaimCheck Report",
              text: "Sharing my ClaimCheck insurance health report PDF.",
            });
            return;
          }
        } catch (error: any) {
          if (error?.name === "AbortError") return;
        }
      }

      triggerDownload(blob, filename);
    } finally {
      setBusy(null);
    }
  };

  const handleShare = () => {
    shareOnWhatsApp(buildShareText(data));
  };

  const baseBtn =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-soft transition-all hover:bg-muted hover:shadow-elevated disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={handleShare} className={baseBtn}>
        <FiShare2 className="h-4 w-4 text-risk-green" />
        Share on WhatsApp
      </button>
      <button type="button" onClick={handlePng} disabled={busy !== null} className={baseBtn}>
        {busy === "png" ? (
          <FiLoader className="h-4 w-4 animate-spin" />
        ) : (
          <FiDownload className="h-4 w-4" />
        )}
        Download PNG
      </button>
      <button type="button" onClick={handlePdf} disabled={busy !== null} className={baseBtn}>
        {busy === "pdf" ? (
          <FiLoader className="h-4 w-4 animate-spin" />
        ) : (
          <FiFileText className="h-4 w-4" />
        )}
        Share PDF
      </button>
      <button
        type="button"
        onClick={onSave}
        className={[
          baseBtn,
          saved ? "border-risk-green/40 bg-risk-green-bg/40 text-risk-green" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <FiBookmark className={["h-4 w-4", saved ? "text-risk-green" : "text-primary"].join(" ")} />
        {saved ? "Saved" : "Save vehicle"}
      </button>
    </div>
  );
}
