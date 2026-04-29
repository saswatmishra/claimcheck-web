import { Link, useParams } from "react-router-dom";
import { FiCopy, FiExternalLink, FiLock } from "react-icons/fi";
import { toast } from "react-toastify";
import { useEffect, useState } from "react";
import AnalysisResult from "../components/AnalysisResult";
import { loadSavedVehicles } from "../hooks/use-saved-vehicles";
import {
  loadSharedReport,
  parseVehicleShareId,
  type VehicleSharePayload,
} from "../services/share-links";

function findLocalVehiclePayload(id: string): VehicleSharePayload | null {
  const vehicle = loadSavedVehicles().find((v) => v.id === id);
  if (!vehicle) return null;

  return {
    v: 1,
    createdAt: new Date(vehicle.savedAt).toISOString(),
    regNumber: vehicle.regNumber,
    nickname: vehicle.nickname,
    analysis: vehicle.analysis,
  };
}

async function copyCurrentUrl() {
  const url = window.location.href;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

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

export default function VehicleShare() {
  const { id = "" } = useParams();
  const [payload, setPayload] = useState<VehicleSharePayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found">("loading");

  useEffect(() => {
    let active = true;

    async function load() {
      const legacyPayload = parseVehicleShareId(id) ?? findLocalVehiclePayload(id);
      if (legacyPayload) {
        if (!active) return;
        setPayload(legacyPayload);
        setStatus("ready");
        return;
      }

      try {
        const share = await loadSharedReport(id);
        if (!active) return;

        if (!share) {
          setPayload(null);
          setStatus("not-found");
          return;
        }

        setPayload({
          v: 1,
          createdAt: share.createdAt ?? new Date().toISOString(),
          regNumber: share.regNumber ?? undefined,
          nickname: share.nickname ?? undefined,
          analysis: share.report,
        });
        setStatus("ready");
      } catch {
        if (!active) return;
        setPayload(null);
        setStatus("not-found");
      }
    }

    setPayload(null);
    setStatus("loading");
    void load();

    return () => {
      active = false;
    };
  }, [id]);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="h-32 animate-pulse rounded-xl bg-white" />
          <div className="mt-6 h-96 animate-pulse rounded-xl bg-white" />
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">
              Report link not found
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              This share link is invalid, incomplete, or only exists in another
              browser.
            </p>
            <Link
              to="/check"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Run a new check
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <FiLock className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Read-only shared report
              </p>
              <h1 className="mt-1 text-lg font-semibold text-slate-900">
                {payload.regNumber ?? "Vehicle report"}
                {payload.nickname ? ` · ${payload.nickname}` : ""}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Opened from a no-login ClaimCheck share link.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await copyCurrentUrl();
                  toast.success("Share link copied.");
                } catch {
                  toast.error("Couldn’t copy share link.");
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              <FiCopy className="h-4 w-4" />
              Copy link
            </button>
            <Link
              to="/check"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <FiExternalLink className="h-4 w-4" />
              Check yours
            </Link>
          </div>
        </div>

        <AnalysisResult data={payload.analysis} />
      </div>
    </main>
  );
}
