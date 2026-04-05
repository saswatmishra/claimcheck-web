import express from "express";
import multer from "multer";
import cors from "cors";
import { ocrBuffer } from "./ocr.js";
import {
  extractVehicleNumber,
  extractExpiryDateISO,
  extractPolicyholderName,
  extractRcOwnerName,
  extractPolicyType,
  extractInsurer,
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

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "claimcheck-api" });
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
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
      const policyVehicleNo = extractVehicleNumber(policyText);
      const policyType = extractPolicyType(policyText);

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
          severity: "warning",
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
          severity: "warning",
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
            severity: "critical",
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
            severity: "warning",
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
          severity: "critical",
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
          severity: "critical",
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
            severity: "critical",
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
            severity: "warning",
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

      return res.json({
        risk,
        summary,
        checked,
        extracted: {
          rc: { ownerName: rcOwner, vehicleNumber: rcVehicleNo },
          policy: {
            policyholderName: policyHolder,
            policyType,
            insurer,
            expiryDate: expiry,
            expiryIso,
            vehicleNumber: policyVehicleNo,
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
