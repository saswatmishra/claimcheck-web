import "./load-env.js";
import express from "express";
import multer from "multer";
import cors from "cors";
import { Database } from "./db.js";
import { SharedReportsRepository } from "./shared-reports-repository.js";
import { ocrBuffer } from "./ocr.js";
import {
  extractVehicleNumber,
  extractExpiryDateISO,
  extractPolicyholderName,
  extractRcOwnerName,
  extractRcMakeModel,
  extractRcFuel,
  extractRcYear,
  extractRcColor,
  extractRcChassisLast4,
  extractRcEngineLast4,
  extractPolicyType,
  extractInsurer,
  extractPolicyNumber,
  extractPolicyIdv,
  extractDlHolderName,
  extractDlValidUptoISO,
} from "./extract.js";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { toLower, startCase } from "lodash-es";
import fs from "fs";
import os from "os";
import path from "path";

// Create a temp credentials file on Render from the env var
if (process.env.GOOGLE_CREDENTIALS_JSON) {
  const keyPath = path.join(os.tmpdir(), "gcp-key.json");
  fs.writeFileSync(keyPath, process.env.GOOGLE_CREDENTIALS_JSON, "utf8");
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
}

const app = express();
const port = Number(process.env.PORT || 3001);
const sharedReports = new SharedReportsRepository();
const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://claimcheck.co.in",
  "https://www.claimcheck.co.in",
];
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) ||
  defaultAllowedOrigins
).filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
  }),
);

const upload = multer({ storage: multer.memoryStorage() });

function isAnalysisReport(value) {
  return (
    value &&
    typeof value === "object" &&
    ["GREEN", "AMBER", "RED"].includes(value.risk) &&
    typeof value.summary === "string" &&
    Array.isArray(value.findings) &&
    Array.isArray(value.fixes)
  );
}

async function pdfBufferToText(buffer) {
  const data = new Uint8Array(buffer);

  const doc = await pdfjs.getDocument({ data }).promise;

  let full = "";
  const maxPages = Math.min(doc.numPages, 2);
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => it.str).join(" ");
    full += "\n" + pageText;
  }

  return full.trim();
}

async function fileToText(file) {
  const mime = (file.mimetype || "").toLowerCase();

  // Images -> Google Vision OCR
  if (mime.startsWith("image/")) {
    return await ocrBuffer(file.buffer);
  }

  // PDFs -> Extract selectable text using pdf.js (no OCR)
  if (mime === "application/pdf") {
    return await pdfBufferToText(file.buffer);
  }

  throw new Error(`Unsupported file type: ${file.mimetype}`);
}

function formatExpiry(iso) {
  if (!iso) return null;
  const options = { day: "2-digit", month: "short", year: "numeric" };
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", options);
}

function headlineByRisk(risk) {
  if (risk === "RED") return "High claim-risk signals detected";
  if (risk === "AMBER") return "Some issues may affect claim readiness";
  return "Low claim-risk signals detected";
}

function deriveWhyThisRisk(risk, findings) {
  if (!findings?.length) {
    return "No major mismatch signals were detected from the uploaded documents on the checks currently supported by ClaimCheck.";
  }

  const top = findings[0];
  if (top.code === "VEHICLE_NO_MISMATCH") {
    return "We found a mismatch between the vehicle number shown on the RC and the number shown on the insurance policy. If these documents do not refer to the same vehicle, an insurer may ask for clarification or corrected records during claim processing.";
  }
  if (top.code === "POLICY_EXPIRED") {
    return "The uploaded policy appears expired. An expired policy can affect claim readiness and may require renewal before proceeding.";
  }
  if (top.code === "OWNER_MISMATCH") {
    return "The RC owner name and policyholder name appear different. This can trigger additional verification and may require endorsement or transfer updates.";
  }

  if (risk === "RED") {
    return "One or more critical mismatches were detected and may create problems during claim verification.";
  }
  if (risk === "AMBER") {
    return "One or more warning signals were detected and may affect claim readiness.";
  }
  return "The uploaded documents look consistent on the key checks we ran.";
}

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "claimcheck-api" });
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/db/healthz", async (_req, res) => {
  try {
    const ok = await Database.healthcheck();
    res.json({ ok });
  } catch (error) {
    res.status(503).json({
      ok: false,
      error: "Database unavailable",
      details: String(error?.message ?? error),
    });
  }
});

app.post("/shares", express.json({ limit: "1mb" }), async (req, res) => {
  try {
    const { report, regNumber = null, nickname = null } = req.body ?? {};

    if (!isAnalysisReport(report)) {
      return res.status(400).json({ error: "Invalid report payload" });
    }

    const share = await sharedReports.create({
      report,
      regNumber:
        typeof regNumber === "string" && regNumber.trim()
          ? regNumber.trim()
          : null,
      nickname:
        typeof nickname === "string" && nickname.trim() ? nickname.trim() : null,
    });

    return res.status(201).json(share);
  } catch (error) {
    console.error("CREATE SHARE ERROR:", error);
    return res.status(500).json({
      error: "Unable to create share link",
      details: String(error?.message ?? error),
    });
  }
});

app.get("/shares/:id", async (req, res) => {
  try {
    const share = await sharedReports.findById(req.params.id);

    if (!share) {
      return res.status(404).json({ error: "Share not found" });
    }

    return res.json(share);
  } catch (error) {
    console.error("GET SHARE ERROR:", error);
    return res.status(500).json({
      error: "Unable to load share link",
      details: String(error?.message ?? error),
    });
  }
});

app.post(
  "/analyze",
  upload.fields([
    { name: "rc", maxCount: 1 },
    { name: "policy", maxCount: 1 },
    { name: "dl", maxCount: 1 }, // optional
  ]),
  async (req, res) => {
    try {
      const rcFile = req.files?.rc?.[0];
      const policyFile = req.files?.policy?.[0];
      const dlFile = req.files?.dl?.[0] ?? null;
      const dlProvided = !!dlFile;

      if (!rcFile || !policyFile) {
        return res.status(400).json({ error: "Missing rc or policy file" });
      }
      const [rcText, policyText, dlText] = await Promise.all([
        fileToText(rcFile),
        fileToText(policyFile),
        dlFile ? fileToText(dlFile) : Promise.resolve(""),
      ]);

      const rcTextOk = rcText && rcText.length > 10;
      const policyTextOk = policyText && policyText.length > 10;

      const rawRcOwner = extractRcOwnerName(rcText);
      const rcOwner = rawRcOwner ? startCase(toLower(rawRcOwner)) : null;

      const policyHolder = extractPolicyholderName(policyText);
      const expiryIso = extractExpiryDateISO(policyText);
      const expiry = formatExpiry(expiryIso);
      let renewalRisk = "Unknown";
      let renewalMessage = null;

      if (expiryIso) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expiryDate = new Date(`${expiryIso}T00:00:00`);
        const diffDays = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diffDays < 0) {
          renewalRisk = "RED";
          renewalMessage =
            "Policy is expired. Renew immediately to avoid fines and claim risk.";
        } else if (diffDays <= 15) {
          renewalRisk = "AMBER";
          renewalMessage = `Policy expires in ${diffDays} day(s). Renew soon.`;
        } else {
          renewalRisk = "GREEN";
          renewalMessage = `Policy valid for ${diffDays} more day(s).`;
        }
      }

      const rcVehicleNo = extractVehicleNumber(rcText);
      const rcMakeModel = extractRcMakeModel(rcText) || extractRcMakeModel(policyText);
      const rcFuel = extractRcFuel(rcText) || extractRcFuel(policyText);
      const rcYear = extractRcYear(rcText);
      const rcColor = extractRcColor(rcText);
      const rcChassisLast4 = extractRcChassisLast4(rcText);
      const rcEngineLast4 = extractRcEngineLast4(rcText);
      const policyVehicleNo = extractVehicleNumber(policyText);
      const policyType = extractPolicyType(policyText);
      const policyNumber = extractPolicyNumber(policyText);
      const idv = extractPolicyIdv(policyText);

      const insurer = extractInsurer(policyText);
      let dlHolder = null;
      let dlValidUptoIso = null;
      let dlExpiryDate = null;
      if (dlProvided) {
        dlHolder = dlText ? extractDlHolderName(dlText) : null;
        dlValidUptoIso = dlText ? extractDlValidUptoISO(dlText) : null;
        dlExpiryDate = formatExpiry(dlValidUptoIso);
      }

      const vehicleMatch =
        rcVehicleNo && policyVehicleNo
          ? rcVehicleNo === policyVehicleNo
            ? "Yes"
            : "No"
          : "Unknown";
      const findings = [];
      const fixes = [];

      let risk = "GREEN";
      let summary =
        "No major claim-blocking issues found (based on extracted text).";

      // If extraction is weak, we should be honest
      if (!rcTextOk || !policyTextOk) {
        risk = "AMBER";
        summary =
          "We couldn’t reliably read one or more documents. Try clearer photos or a text-based PDF.";
        findings.push({
          code: "LOW_TEXT_CONFIDENCE",
          title: "Couldn’t read document text reliably",
          detail:
            "If your PDF is scanned (image-only), text extraction may be empty. Upload clear photos or a text-based PDF.",
          severity: "AMBER",
        });
        fixes.push({
          title: "Improve document readability",
          steps: [
            "Use a clear, well-lit photo (no glare).",
            "Crop to the document area.",
            "If using PDF, upload a text-based PDF (not scanned), or upload images instead.",
          ],
        });
      }

      if (policyType === "Act Only") {
        findings.push({
          code: "ACT_ONLY_POLICY",
          title: "Policy appears to be Act Only (Liability Only)",
          detail:
            "Act Only policy covers damage or injury caused to others, but does not cover damage to your own vehicle. Please check if this suits your requirement.",
          severity: "AMBER",
        });
        fixes.push({
          title: "Confirm coverage type",
          steps: [
            "If you want own-damage coverage, consider Comprehensive coverage at renewal.",
            "Verify coverage details inside the insurer app/portal.",
          ],
        });

        if (risk !== "RED") risk = "AMBER";
        if (summary.includes("No major")) {
          summary = "Some coverage gaps detected (based on extracted text).";
        }
      }

      if (expiryIso) {
        if (renewalRisk === "RED") {
          risk = "RED";
          summary = "Policy appears expired (based on extracted text).";
          findings.push({
            code: "POLICY_EXPIRED",
            title: "Policy appears expired",
            detail:
              renewalMessage ??
              "The policy expiry date looks to be in the past.",
            severity: "RED",
          });
          fixes.push({
            title: "Renew your policy",
            steps: ["Renew immediately.", "Re-run ClaimCheck after renewal."],
          });
        } else if (renewalRisk === "AMBER" && risk !== "RED") {
          // only set AMBER if we aren't already RED from other checks
          risk = "AMBER";
          summary = "Renewal due soon (based on extracted text).";
          findings.push({
            code: "RENEWAL_DUE_SOON",
            title: "Policy expires soon",
            detail: renewalMessage ?? "Your policy expiry is within 15 days.",
            severity: "AMBER",
          });
          fixes.push({
            title: "Renew soon",
            steps: [
              "Renew your policy before expiry to avoid fines.",
              "Re-run ClaimCheck after renewal.",
            ],
          });
        }
      }

      if (
        rcOwner &&
        policyHolder &&
        rcOwner.toUpperCase() !== policyHolder.toUpperCase()
      ) {
        risk = "RED";
        summary =
          "High claim rejection risk detected (based on extracted text).";
        findings.push({
          code: "OWNER_MISMATCH",
          title: "RC owner and policyholder don’t match",
          detail: "Your RC owner name and policyholder name appear different.",
          severity: "RED",
        });
        fixes.push({
          title: "Fix ownership mismatch",
          steps: [
            "Confirm RC owner name.",
            "Request endorsement/name transfer with insurer if RC transferred.",
            "Otherwise transfer RC first or keep policy in RC owner name.",
          ],
        });
      }

      if (vehicleMatch === "No") {
        risk = "RED";
        summary =
          "High claim rejection risk detected (based on extracted text).";
        findings.push({
          code: "VEHICLE_NO_MISMATCH",
          title: "Vehicle number mismatch",
          detail: "Vehicle number on policy and RC appear different.",
          severity: "RED",
        });
        fixes.push({
          title: "Fix vehicle number mismatch",
          steps: [
            "Verify vehicle number on both docs.",
            "Request correction with insurer if policy has wrong registration number.",
          ],
        });
      }

      if (fixes.length === 0) {
        fixes.push({
          title: "Next steps",
          steps: [
            "Set renewal reminders.",
            "Re-check after RC transfer or address change.",
          ],
        });
      }

      if (dlFile && dlValidUptoIso) {
        const t = new Date(`${dlValidUptoIso}T00:00:00`).getTime();
        if (!Number.isNaN(t) && t < Date.now()) {
          risk = "RED";
          summary = "High risk: driving license appears expired.";
          findings.push({
            code: "DL_EXPIRED",
            title: "Driving license appears expired",
            detail:
              "An expired driving license can lead to claim rejection risk.",
            severity: "RED",
          });
          fixes.push({
            title: "Renew your driving license",
            steps: [
              "Renew DL via Parivahan/Sarathi portal.",
              "Re-run ClaimCheck after renewal.",
            ],
          });
        }
      }

      if (dlFile && dlHolder && rcOwner) {
        const a = dlHolder.toUpperCase().replace(/\s+/g, " ").trim();
        const b = rcOwner.toUpperCase().replace(/\s+/g, " ").trim();

        if (a !== b) {
          // Don’t always make RED. Use AMBER: mismatch might be spouse/parent vehicle.
          if (risk !== "RED") risk = "AMBER";
          if (summary.startsWith("No major"))
            summary = "Some issues may affect claim smoothness.";

          findings.push({
            code: "DL_RC_NAME_MISMATCH",
            title: "DL holder and RC owner names don’t match",
            detail:
              "If the driver is not the RC owner, insurers may ask for clarification depending on claim type and documents.",
            severity: "AMBER",
          });

          fixes.push({
            title: "Keep supporting documents ready",
            steps: [
              "Ensure the driver has a valid DL for the vehicle type.",
              "Keep relationship/authorization proof if the car is used by family.",
              "For ownership transfer, update RC + policy endorsement.",
            ],
          });
        }
      }
      const checked = [
        { label: "RC Owner", value: rcOwner ?? "Unknown" },
        { label: "Policyholder", value: policyHolder ?? "Unknown" },
        { label: "Policy Expiry", value: expiry ?? "Not checked" },
        { label: "Policy Type", value: policyType ?? "Unknown" },
        { label: "Policy Number", value: policyNumber ?? "Unknown" },
        { label: "IDV", value: idv ?? "Unknown" },
        { label: "Vehicle Number Match", value: vehicleMatch ?? "Unknown" },
        { label: "Renewal Risk", value: renewalRisk ?? "Unknown" },
      ];

      if (dlProvided) {
        checked.push(
          { label: "DL Holder", value: dlHolder ?? "Unknown" },
          {
            label: "DL Valid Upto",
            value: dlExpiryDate ?? "Not checked",
          },
        );
      }

      const documents = [
        { label: "RC", status: "UPLOADED" },
        { label: "Policy", status: "UPLOADED" },
        {
          label: "Driving License",
          status: dlProvided ? "UPLOADED" : "NOT_UPLOADED",
          note: dlProvided
            ? undefined
            : "Upload to verify license-related risk signals",
        },
        { label: "Permit", status: "NOT_REQUIRED" },
        { label: "Fitness Certificate", status: "NOT_REQUIRED" },
      ];

      const headline = headlineByRisk(risk);
      const whyThisRisk = deriveWhyThisRisk(risk, findings);
      const disclaimer =
        "ClaimCheck is a read-only document consistency check. Final claim decisions depend on insurer verification, policy terms, applicable regulations, and the facts of the incident.";

      return res.json({
        risk,
        headline,
        summary,
        whyThisRisk,
        checked,
        documents,
        extracted: {
          rc: {
            ownerName: rcOwner,
            vehicleNumber: rcVehicleNo,
            makeModel: rcMakeModel,
            fuel: rcFuel,
            year: rcYear,
            color: rcColor,
            chassisLast4: rcChassisLast4,
            engineLast4: rcEngineLast4,
          },
          policy: {
            policyholderName: policyHolder,
            policyType,
            policyNumber,
            idv,
            insurer,
            expiryDate: expiry,
            expiryIso,
            vehicleNumber: policyVehicleNo,
          },
          dl: {
            provided: dlProvided,
            holderName: dlHolder,
            validUptoIso: dlValidUptoIso,
            validUpto: dlExpiryDate,
          },
          meta: {
            rcTextLength: rcText?.length ?? 0,
            policyTextLength: policyText?.length ?? 0,
            rcFileType: rcFile.mimetype,
            policyFileType: policyFile.mimetype,
          },
        },
        findings,
        fixes,
        disclaimer,
      });
    } catch (e) {
      console.error("ANALYZE ERROR:", e);
      return res.status(500).json({
        error: "Analyze failed",
        details: String(e?.message ?? e),
      });
    }
  },
);

app.listen(port, () => console.log(`API running on port ${port}`));
