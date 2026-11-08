import "./load-env.js";
import express from "express";
import multer from "multer";
import cors from "cors";
import { Database } from "./db.js";
import { SharedReportsRepository } from "./shared-reports-repository.js";
import { createApiAbuseGuards } from "./abuse-guards.js";
import {
  extractDocumentFieldsAi,
  fieldValue,
  shouldUseAiExtraction,
} from "./ai-extract.js";
import { DocumentInputError, fileToText } from "./document-input.js";
import { DOCUMENT_MIME_TYPES, MAX_FILE_BYTES, calendarDaysBetween, normalizePersonName, normalizeVehicleNumber, validDateISO } from "../shared/documents.js";
import { isAnalysisResult } from "../shared/report.js";
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
import { toLower, startCase } from "lodash-es";
import { pathToFileURL } from "node:url";

export const app = express();
const port = Number(process.env.PORT || 3001);
const sharedReports = new SharedReportsRepository();
const abuseGuards = createApiAbuseGuards();
// Trust only a known number of proxy hops. Defaulting to 0 prevents forged client IPs.
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (!Number.isSafeInteger(trustedProxyHops) || trustedProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
}
app.set("trust proxy", trustedProxyHops);
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
      callback(new DocumentInputError("This origin is not allowed.", 403));
    },
  }),
);

const upload = multer({
  storage: multer.memoryStorage(),
  // Busboy emits its parts-limit event upon reaching the limit, so allow the
  // terminating boundary after three files. The files/fields limits stay strict.
  limits: { fileSize: MAX_FILE_BYTES, files: 3, fields: 0, parts: 4 },
  fileFilter(_req, file, callback) {
    callback(DOCUMENT_MIME_TYPES.includes(file.mimetype)
      ? null
      : new DocumentInputError("Choose a PDF, JPG, PNG, or WebP file.", 400), true);
  },
});

function firstValue(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() && !/^(unknown|not checked)$/i.test(value.trim())) return value.trim();
    if (value != null && typeof value !== "string") return value;
  }
  return null;
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

  const top = findings.find((finding) => finding.severity === risk) ?? findings[0];
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
  if (risk === "AMBER") return top.detail;
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
  } catch {
    res.status(503).json({
      ok: false,
      error: "Database unavailable",
    });
  }
});

app.post(
  "/extract-policy-ai",
  abuseGuards.extractAi,
  express.json({ limit: "12mb" }),
  async (req, res) => {
    try {
      const {
        documentType = "policy",
        ocrText = "",
        imageBase64 = null,
        mimeType = "image/jpeg",
      } = req.body ?? {};

      if (!['rc', 'policy', 'dl'].includes(documentType) || typeof ocrText !== "string" ||
          (imageBase64 !== null && typeof imageBase64 !== "string") ||
          !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        return res.status(400).json({ error: "Invalid document extraction request." });
      }

      const result = await extractDocumentFieldsAi({
        documentType,
        ocrText,
        imageBase64,
        mimeType,
      });

      return res.json(result);
    } catch (error) {
      console.error("AI EXTRACT ERROR:", error);
      return res.status(500).json({
        error: "AI extraction failed",
      });
    }
  },
);

app.post("/shares", abuseGuards.shares, express.json({ limit: "1mb" }), async (req, res) => {
  try {
    const { report, regNumber = null, nickname = null } = req.body ?? {};

    if (!isAnalysisResult(report)) {
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
    });
  }
});

app.post(
  "/analyze",
  abuseGuards.analyze,
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
      let rcOwner = rawRcOwner ? startCase(toLower(rawRcOwner)) : null;

      let policyHolder = extractPolicyholderName(policyText);
      let expiryIso = extractExpiryDateISO(policyText);
      let renewalRisk = "Unknown";
      let renewalMessage = null;

      let rcVehicleNo = extractVehicleNumber(rcText);
      let rcMakeModel = extractRcMakeModel(rcText) || extractRcMakeModel(policyText);
      let rcFuel = extractRcFuel(rcText) || extractRcFuel(policyText);
      let rcYear = extractRcYear(rcText);
      let rcColor = extractRcColor(rcText);
      let rcChassisLast4 = extractRcChassisLast4(rcText);
      let rcEngineLast4 = extractRcEngineLast4(rcText);
      let policyVehicleNo = extractVehicleNumber(policyText);
      let policyType = extractPolicyType(policyText);
      let policyNumber = extractPolicyNumber(policyText);
      let idv = extractPolicyIdv(policyText);

      let insurer = extractInsurer(policyText);
      let dlHolder = null;
      let dlValidUptoIso = null;
      if (dlProvided) {
        dlHolder = dlText ? extractDlHolderName(dlText) : null;
        dlValidUptoIso = dlText ? extractDlValidUptoISO(dlText) : null;
      }

      const aiEnabled = process.env.AI_EXTRACTION_ENABLED !== "false";

      if (
        aiEnabled &&
        shouldUseAiExtraction([rcOwner, rcVehicleNo, rcMakeModel])
      ) {
        try {
          const result = await extractDocumentFieldsAi({
            documentType: "rc",
            ocrText: rcText,
            file: rcFile,
          });
          const extraction = result.extraction;
          rcOwner = firstValue(rcOwner, fieldValue(extraction, "ownerName"));
          rcVehicleNo = firstValue(rcVehicleNo, fieldValue(extraction, "vehicleNumber"));
          rcMakeModel = firstValue(rcMakeModel, fieldValue(extraction, "makeModel"));
          rcFuel = firstValue(rcFuel, fieldValue(extraction, "fuel"));
          rcYear = firstValue(rcYear, fieldValue(extraction, "year"));
          rcColor = firstValue(rcColor, fieldValue(extraction, "color"));
          rcChassisLast4 = firstValue(
            rcChassisLast4,
            fieldValue(extraction, "chassisLast4"),
          );
          rcEngineLast4 = firstValue(
            rcEngineLast4,
            fieldValue(extraction, "engineLast4"),
          );
        } catch {
          // Missing critical fields are explicitly reported below if the fallback fails.
        }
      }

      if (
        aiEnabled &&
        shouldUseAiExtraction([
          policyHolder,
          policyVehicleNo,
          expiryIso,
          policyType,
          policyNumber,
          idv,
          insurer,
        ])
      ) {
        try {
          const result = await extractDocumentFieldsAi({
            documentType: "policy",
            ocrText: policyText,
            file: policyFile,
          });
          const extraction = result.extraction;
          policyHolder = firstValue(
            policyHolder,
            fieldValue(extraction, "policyholderName"),
          );
          policyVehicleNo = firstValue(
            policyVehicleNo,
            fieldValue(extraction, "vehicleNumber"),
          );
          expiryIso = firstValue(expiryIso, fieldValue(extraction, "expiryIso"));
          policyType = firstValue(policyType, fieldValue(extraction, "policyType"));
          policyNumber = firstValue(
            policyNumber,
            fieldValue(extraction, "policyNumber"),
          );
          idv = firstValue(idv, fieldValue(extraction, "idv"));
          insurer = firstValue(insurer, fieldValue(extraction, "insurer"));
        } catch {
          // Preserve deterministic fields when the AI provider is unavailable.
        }
      }

      if (
        aiEnabled &&
        dlProvided &&
        shouldUseAiExtraction([dlHolder, dlValidUptoIso])
      ) {
        try {
          const result = await extractDocumentFieldsAi({
            documentType: "dl",
            ocrText: dlText,
            file: dlFile,
          });
          const extraction = result.extraction;
          dlHolder = firstValue(dlHolder, fieldValue(extraction, "holderName"));
          dlValidUptoIso = firstValue(
            dlValidUptoIso,
            fieldValue(extraction, "validUptoIso"),
          );
        } catch {
          // An unreadable optional license must not be treated as verified.
        }
      }

      expiryIso = validDateISO(expiryIso);
      dlValidUptoIso = validDateISO(dlValidUptoIso);
      rcVehicleNo = normalizeVehicleNumber(rcVehicleNo);
      policyVehicleNo = normalizeVehicleNumber(policyVehicleNo);
      const todayIso = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date());
      const expiry = formatExpiry(expiryIso);
      const dlExpiryDate = formatExpiry(dlValidUptoIso);

      if (expiryIso) {
        const diffDays = calendarDaysBetween(todayIso, expiryIso);
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

      const missingFields = [
        ["RC owner name", rcOwner],
        ["RC vehicle number", rcVehicleNo],
        ["policyholder name", policyHolder],
        ["policy vehicle number", policyVehicleNo],
        ["policy expiry date", expiryIso],
        ["policy type", firstValue(policyType)],
        ...(dlProvided ? [["driving license holder", dlHolder], ["driving license expiry date", dlValidUptoIso]] : []),
      ].filter(([, value]) => !firstValue(value)).map(([label]) => label);
      if (missingFields.length) {
        risk = "AMBER";
        summary = "Some key details could not be verified. Review the missing fields before relying on this report.";
        findings.push({
          code: "MISSING_CRITICAL_FIELDS",
          title: "Some checks could not be completed",
          detail: `We couldn’t reliably read: ${missingFields.join(", ")}. Missing details are not a passed check.`,
          severity: "AMBER",
        });
        fixes.push({
          title: "Verify the missing details",
          steps: ["Check the missing fields against your original documents.", "Upload a clearer copy that shows the names, registration numbers, coverage type, and validity dates, then run the check again."],
        });
      }

      if (policyType === "Own Damage Only") {
        risk = "AMBER";
        summary = "The uploaded document appears to be an own-damage-only policy. Review your other coverage documents.";
        findings.push({
          code: "OWN_DAMAGE_ONLY_POLICY",
          title: "Separate coverage document may be needed",
          detail: "This document is labelled as own damage only. We have not verified a separate third-party policy.",
          severity: "AMBER",
        });
        fixes.push({ title: "Review the full policy set", steps: ["Check your separate third-party policy and its validity dates with your insurer."] });
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
        normalizePersonName(rcOwner) !== normalizePersonName(policyHolder)
      ) {
        risk = "RED";
        summary =
          "Document details differ. Check the extracted values against your originals.";
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
          "Document details differ. Check the extracted values against your originals.";
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
        if (calendarDaysBetween(todayIso, dlValidUptoIso) < 0) {
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
        const a = normalizePersonName(dlHolder);
        const b = normalizePersonName(rcOwner);

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
        { label: "Permit", status: "NOT_CHECKED", note: "Requirements depend on your vehicle and use." },
        { label: "Fitness Certificate", status: "NOT_CHECKED", note: "Requirements depend on your vehicle and use." },
      ];

      const headline = headlineByRisk(risk);
      findings.sort((a, b) => ({ RED: 0, AMBER: 1, GREEN: 2 })[a.severity] - ({ RED: 0, AMBER: 1, GREEN: 2 })[b.severity]);
      const whyThisRisk = deriveWhyThisRisk(risk, findings);
      const disclaimer =
        "ClaimCheck is a read-only document consistency check. Final claim decisions depend on insurer verification, policy terms, applicable regulations, and the facts of the incident.";

      return res.json({
        checkedAt: new Date().toISOString(),
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
      if (e instanceof DocumentInputError) return res.status(e.status).json({ error: e.message });
      console.error("ANALYZE ERROR:", e);
      return res.status(500).json({
        error: "We couldn’t finish reading your documents. Please try again in a moment.",
      });
    }
  },
);

// Keep errors from upload middleware consistent with the JSON API.
app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: error.code === "LIMIT_FILE_SIZE"
        ? "Each document must be 8 MB or smaller. Choose a smaller file and try again."
        : "Upload one RC, one policy, and optionally one driving license file.",
    });
  }
  if (error instanceof DocumentInputError) return res.status(error.status).json({ error: error.message });
  if (error.type === "entity.too.large") return res.status(413).json({ error: "This request is too large." });
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON request." });
  console.error("REQUEST ERROR:", error);
  return res.status(500).json({ error: "The request could not be completed. Please try again." });
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(port, () => console.log(`API running on port ${port}`));
}
