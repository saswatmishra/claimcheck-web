import { useNavigate } from "react-router-dom";
import { track } from "@vercel/analytics";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiEye,
  FiFileText,
  FiLock,
  FiPlayCircle,
  FiShield,
  FiShare2,
} from "react-icons/fi";

const CHECKS = [
  { label: "Vehicle number consistency", icon: FiCheckCircle },
  { label: "Policy validity", icon: FiShield },
  { label: "Policy type", icon: FiFileText },
  { label: "Missing documents", icon: FiAlertTriangle },
  { label: "Claim-risk signals", icon: FiShield },
  { label: "Coverage warnings", icon: FiAlertTriangle },
];

const TRUST_INDICATORS = [
  { label: "Files are processed securely", icon: FiLock },
  { label: "Documents are not publicly shared", icon: FiShare2 },
  { label: "Read-only analysis", icon: FiEye },
  { label: "Demo mode available", icon: FiPlayCircle },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <h1 className="text-4xl font-bold text-slate-900 text-center">
        Check whether your vehicle documents are claim-ready.
      </h1>

      <p className="mt-4 text-slate-600 text-center max-w-xl">
        Securely upload your RC and insurance documents to run a
        claim-readiness check.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => {
            track("demo_started", { source: "landing" });
            navigate("/check?demo=1");
          }}
          className="rounded-lg bg-slate-900 px-6 py-3 text-lg font-semibold text-white"
        >
          Try Demo
        </button>
        <button
          onClick={() => {
            track("real_check_started", { source: "landing" });
            navigate("/check");
          }}
          className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-lg font-semibold text-slate-900"
        >
          Check My Insurance
        </button>
      </div>

      <div className="mt-6 grid w-full max-w-3xl gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST_INDICATORS.map(({ label, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600"
          >
            <Icon className="h-4 w-4 shrink-0 text-slate-700" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <section className="mt-12 w-full max-w-3xl">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">
          What ClaimCheck checks
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHECKS.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="flex min-h-16 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left"
            >
              <Icon className="h-5 w-5 shrink-0 text-slate-700" />
              <span className="text-sm font-medium leading-snug text-slate-800">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
