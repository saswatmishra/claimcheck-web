import { useState } from "react";
import { FiBookmark, FiDownload, FiFileText, FiLink, FiLoader, FiShare2 } from "react-icons/fi";
import { downloadPng, elementToPdfBlob, shareOnWhatsApp, triggerDownload } from "../lib/export-card";
import { createVehicleShareUrl } from "../services/share-links";
import type { AnalysisResult as AnalysisData } from "../types/analysis";

interface ResultActionsProps {
  data: AnalysisData;
  cardRef: React.RefObject<HTMLDivElement | null>;
  onSave: () => void;
  saved?: boolean;
  filenameBase?: string;
}

function buildShareText(data: AnalysisData, shareUrl: string) {
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
    shareUrl,
    "",
    "Verify your RC & Insurance: https://claimcheck.co.in",
  ]
    .filter(Boolean)
    .join("\n");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export default function ResultActions({
  data,
  cardRef,
  onSave,
  saved,
  filenameBase = "claimcheck-report",
}: ResultActionsProps) {
  const [busyAction, setBusyAction] = useState<"png" | "pdf" | "link" | "share" | null>(null);
  const [linkStatus, setLinkStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [exportError, setExportError] = useState<string | null>(null);

  const handlePng = async () => {
    if (!cardRef.current) return;
    setBusyAction("png");
    setExportError(null);
    try {
      await downloadPng(cardRef.current, `${filenameBase}.png`);
    } catch {
      setExportError("Couldn’t create the image. Please try again, or use your browser’s print option.");
    } finally {
      setBusyAction(null);
    }
  };

  const handlePdf = async () => {
    if (!cardRef.current) return;
    setBusyAction("pdf");
    setExportError(null);
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
        } catch (error: unknown) {
          if (isAbortError(error)) return;
        }
      }

      triggerDownload(blob, filename);
    } catch {
      setExportError("Couldn’t create the PDF. Please try again, or use your browser’s print option.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleShare = async () => {
    setBusyAction("share");
    setLinkStatus("idle");
    try {
      const url = await createVehicleShareUrl(data);
      shareOnWhatsApp(buildShareText(data, url));
    } catch {
      setLinkStatus("failed");
      window.setTimeout(() => setLinkStatus("idle"), 2400);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyLink = async () => {
    setBusyAction("link");
    setLinkStatus("idle");
    try {
      const url = await createVehicleShareUrl(data);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement("input");
        input.value = url;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setLinkStatus("copied");
      window.setTimeout(() => setLinkStatus("idle"), 1800);
    } catch {
      setLinkStatus("failed");
      window.setTimeout(() => setLinkStatus("idle"), 2400);
    } finally {
      setBusyAction(null);
    }
  };

  const baseBtn =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-soft transition-all hover:bg-muted hover:shadow-elevated disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={handleShare} disabled={busyAction !== null} className={baseBtn}>
        {busyAction === "share" ? (
          <FiLoader className="h-4 w-4 animate-spin" />
        ) : (
          <FiShare2 className="h-4 w-4 text-risk-green" />
        )}
        Share on WhatsApp
      </button>
      <button type="button" onClick={handleCopyLink} disabled={busyAction !== null} className={baseBtn}>
        {busyAction === "link" ? (
          <FiLoader className="h-4 w-4 animate-spin" />
        ) : (
          <FiLink className="h-4 w-4 text-primary" />
        )}
        {linkStatus === "copied"
          ? "Link copied"
          : linkStatus === "failed"
            ? "Link failed"
            : "Copy link"}
      </button>
      <button type="button" onClick={handlePng} disabled={busyAction !== null} className={baseBtn}>
        {busyAction === "png" ? (
          <FiLoader className="h-4 w-4 animate-spin" />
        ) : (
          <FiDownload className="h-4 w-4" />
        )}
        Download PNG
      </button>
      <button type="button" onClick={handlePdf} disabled={busyAction !== null} className={baseBtn}>
        {busyAction === "pdf" ? (
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
      <p className="w-full text-xs leading-5 text-slate-500">Share links contain the report’s extracted details and can be viewed by anyone with the link. Saved vehicles stay in this browser.</p>
      {exportError && <p role="alert" className="w-full text-sm text-red-700">{exportError}</p>}
    </div>
  );
}
