import { Link, useNavigate } from "react-router-dom";
import { track } from "@vercel/analytics";
import {
  FiArrowRight,
  FiFileText,
  FiLock,
  FiPlayCircle,
  FiShield,
} from "react-icons/fi";

const CHECK_NOTE =
  "ClaimCheck compares your RC and insurance policy for vehicle number consistency, policy validity, policy type, missing or optional documents, claim-risk signals, and coverage warnings. It is a read-only readiness check, not a final claim decision.";

const TRUST_INDICATORS = [
  {
    title: "Secure processing",
    body: "Uploaded files are processed only to extract fields and generate your readiness report.",
    icon: FiLock,
  },
  {
    title: "No public document files",
    body: "Share links store generated report details, not the original files you uploaded.",
    icon: FiShield,
  },
  {
    title: "Try without uploading",
    body: "Demo mode lets you see sample results before choosing to upload real documents.",
    icon: FiPlayCircle,
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto flex max-w-5xl flex-col px-6 pb-16 pt-14 sm:pt-20">
        <section className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase text-slate-600">
            <FiShield className="h-3.5 w-3.5 text-emerald-600" />
            Insurance claim readiness
          </p>
          <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Check whether your vehicle documents are claim-ready.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Upload your RC and insurance policy to catch common document issues
            before they slow down a claim.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={() => {
                track("real_check_started", { source: "landing" });
                navigate("/check");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Check My Insurance
              <FiArrowRight className="h-4 w-4" />
            </button>
            <Link
              to="/privacy"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-900 transition-colors hover:bg-slate-50"
            >
              Read Privacy Policy
            </Link>
          </div>
        </section>

        <section className="mt-16 border-y border-slate-200 py-8">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <div className="flex items-center gap-3 text-slate-900">
                <FiFileText className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold">What ClaimCheck checks</h2>
              </div>
            </div>
            <p className="text-base leading-7 text-slate-600">{CHECK_NOTE}</p>
          </div>
        </section>

        <section className="mt-10">
          <div className="grid gap-4 md:grid-cols-3">
            {TRUST_INDICATORS.map(({ title, body, icon: Icon }) => (
              <div
                key={title}
                className="rounded-lg border border-slate-200 bg-white p-5"
              >
                <Icon className="h-5 w-5 text-emerald-600" />
                <h3 className="mt-4 text-sm font-semibold text-slate-950">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-lg border border-slate-200 bg-slate-950 p-6 text-white sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-300">
                Want to see the result first?
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Try the demo without uploading documents.
              </h2>
            </div>
            <button
              onClick={() => {
                track("demo_started", { source: "landing_bottom" });
                navigate("/check?demo=1");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-base font-semibold text-slate-950 transition-colors hover:bg-slate-100"
            >
              <FiPlayCircle className="h-4 w-4" />
              Try Demo
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
