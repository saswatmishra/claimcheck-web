import { Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiDatabase,
  FiFileText,
  FiLock,
  FiShare2,
  FiShield,
} from "react-icons/fi";

const POLICY_SECTIONS = [
  {
    title: "What you upload",
    body: [
      "ClaimCheck analyzes the vehicle documents you choose to upload, such as RC, insurance policy, and optional driving license files.",
      "The app extracts fields such as vehicle number, owner or policyholder name, policy type, policy expiry, insurer, and driving license validity when available.",
    ],
    icon: FiFileText,
  },
  {
    title: "How files are processed",
    body: [
      "Files are sent to the ClaimCheck API only to run OCR, field extraction, and document consistency checks.",
      "The current analysis upload flow handles files in server memory during processing. Image OCR and AI field extraction may use configured service providers such as Google Cloud Vision and OpenAI.",
    ],
    icon: FiLock,
  },
  {
    title: "What is stored",
    body: [
      "Uploaded document files are not stored as public document files by the normal analysis flow.",
      "If you save a vehicle, the generated report and reminder settings are stored in your browser local storage. If you create a share link, ClaimCheck stores the generated report details, registration number, and nickname on the server. Links expire after 90 days by default. Expiring a link stops access but does not automatically delete the stored record.",
    ],
    icon: FiDatabase,
  },
  {
    title: "Sharing and visibility",
    body: [
      "A shared report link is read-only and can be opened by anyone who has that link until it expires.",
      "Do not create or forward a share link if you do not want someone else to see the extracted report details.",
    ],
    icon: FiShare2,
  },
  {
    title: "Analytics",
    body: [
      "ClaimCheck uses product analytics to understand page visits and actions such as starting a demo or real check.",
      "Analytics events are intended to measure product usage, not to store uploaded document files.",
    ],
    icon: FiShield,
  },
  {
    title: "Document wallet status",
    body: [
      "ClaimCheck is not currently a government document locker, insurer, broker, or claim authority.",
      "A DigiLocker-style document flow would need explicit user consent, secure account controls, and verified document-provider integration before it is offered as a live feature.",
    ],
    icon: FiShield,
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-4xl px-6 pb-16 pt-10 sm:pt-14">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <FiArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <header className="mt-8 border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold uppercase text-emerald-700">
            ClaimCheck
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Privacy Policy
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            ClaimCheck is designed as a read-only insurance claim-readiness
            check. This policy explains how document files, extracted details,
            saved reports, share links, and analytics are handled.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Effective date: June 7, 2026
          </p>
        </header>

        <section className="mt-8 grid gap-4">
          {POLICY_SECTIONS.map(({ title, body, icon: Icon }) => (
            <article
              key={title}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                    {body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-semibold text-slate-950">
            Your choices
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
            <p>
              You can use demo mode without uploading files. You can avoid
              creating share links if you do not want report details stored on
              the server for link access.
            </p>
            <p>
              Saved vehicle reports are stored in your browser. You can remove
              them inside the app or clear browser storage for ClaimCheck.
            </p>
            <p>
              For privacy questions, email{" "}
              <a
                href="mailto:privacy@claimcheck.co.in"
                className="font-medium text-slate-950 underline underline-offset-4"
              >
                privacy@claimcheck.co.in
              </a>
              .
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
