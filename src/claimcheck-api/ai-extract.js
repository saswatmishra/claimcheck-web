const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4o-mini";

const FIELD_NAMES = {
  rc: [
    "ownerName",
    "vehicleNumber",
    "makeModel",
    "fuel",
    "year",
    "color",
    "chassisLast4",
    "engineLast4",
  ],
  policy: [
    "policyholderName",
    "vehicleNumber",
    "insurer",
    "policyType",
    "policyNumber",
    "idv",
    "expiryIso",
  ],
  dl: ["holderName", "validUptoIso"],
};

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    documentType: { type: "string", enum: ["rc", "policy", "dl"] },
    fields: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        [
          ...FIELD_NAMES.rc,
          ...FIELD_NAMES.policy,
          ...FIELD_NAMES.dl,
        ].map((name) => [
          name,
          {
            type: "object",
            additionalProperties: false,
            properties: {
              value: { anyOf: [{ type: "string" }, { type: "null" }] },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              reason: { type: "string" },
            },
            required: ["value", "confidence", "reason"],
          },
        ]),
      ),
      required: [
        ...FIELD_NAMES.rc,
        ...FIELD_NAMES.policy,
        ...FIELD_NAMES.dl,
      ],
    },
  },
  required: ["documentType", "fields"],
};

function dataUrlFromFile(file) {
  if (!file?.buffer || !file?.mimetype?.toLowerCase().startsWith("image/")) {
    return null;
  }

  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}

function normalizeDocumentType(documentType) {
  if (documentType === "rc" || documentType === "policy" || documentType === "dl") {
    return documentType;
  }
  throw new Error(`Unsupported AI extraction documentType: ${documentType}`);
}

function normalizeField(value) {
  if (!value || typeof value !== "object") {
    return { value: null, confidence: "low", reason: "Field was not returned" };
  }

  const rawValue = typeof value.value === "string" ? value.value.trim() : null;
  const confidence = ["high", "medium", "low"].includes(value.confidence)
    ? value.confidence
    : "low";
  const reason =
    typeof value.reason === "string" && value.reason.trim()
      ? value.reason.trim()
      : rawValue
        ? "Extracted from visible document content"
        : "Not visible or not confidently identified";

  return {
    value: rawValue || null,
    confidence,
    reason,
  };
}

function normalizeExtraction(documentType, parsed) {
  const fields = {};
  for (const name of Object.keys(EXTRACTION_SCHEMA.properties.fields.properties)) {
    fields[name] = normalizeField(parsed?.fields?.[name]);
  }

  return {
    documentType,
    fields,
    raw: parsed,
  };
}

function getOutputText(response) {
  if (typeof response.output_text === "string") return response.output_text;

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return "";
}

export function shouldUseAiExtraction(requiredValues) {
  return requiredValues.some((value) => {
    if (typeof value === "string") return value.trim().length === 0;
    return value == null;
  });
}

export async function extractDocumentFieldsAi({
  documentType,
  ocrText = "",
  file = null,
  imageBase64 = null,
  mimeType = "image/jpeg",
}) {
  const normalizedType = normalizeDocumentType(documentType);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      skipped: true,
      reason: "OPENAI_API_KEY is not configured",
      extraction: null,
    };
  }

  const dataUrl =
    imageBase64 && typeof imageBase64 === "string"
      ? `data:${mimeType};base64,${imageBase64}`
      : dataUrlFromFile(file);

  const content = [
    {
      type: "input_text",
      text: [
        `Document type: ${normalizedType}`,
        "Extract only values visible in the document.",
        "Do not infer, assume, complete, or guess missing values.",
        "If a field is unclear, cropped, hidden, absent, or ambiguous, return value null with low confidence.",
        "For dates, use ISO YYYY-MM-DD only when the full date is visible and unambiguous.",
        "For vehicle numbers, preserve the registration number without spaces when clearly visible.",
        "OCR text follows:",
        ocrText || "(No OCR text available.)",
      ].join("\n"),
    },
  ];

  if (dataUrl) {
    content.push({
      type: "input_image",
      image_url: dataUrl,
    });
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content:
            "You are a strict document field extractor for vehicle insurance, RC, and driving license documents. Return structured JSON only. Never decide risk.",
        },
        {
          role: "user",
          content,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "claimcheck_document_extraction",
          strict: true,
          schema: EXTRACTION_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`OpenAI extraction failed (${response.status}). ${details}`);
  }

  const json = await response.json();
  const text = getOutputText(json);
  const parsed = text ? JSON.parse(text) : null;

  return {
    skipped: false,
    reason: null,
    extraction: normalizeExtraction(normalizedType, parsed),
  };
}

export function fieldValue(extraction, name) {
  const field = extraction?.fields?.[name];
  if (!field || field.confidence === "low") return null;
  return field.value;
}
