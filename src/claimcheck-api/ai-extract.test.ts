// @ts-nocheck
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractDocumentFieldsAi,
  fieldValue,
  shouldUseAiExtraction,
} from "./ai-extract.js";

function mockOpenAiResponse(fields) {
  return {
    documentType: "policy",
    fields: {
      ownerName: { value: null, confidence: "low", reason: "Not a RC" },
      vehicleNumber: { value: "OD02AB1234", confidence: "high", reason: "Visible" },
      makeModel: { value: null, confidence: "low", reason: "Not visible" },
      fuel: { value: null, confidence: "low", reason: "Not visible" },
      year: { value: null, confidence: "low", reason: "Not visible" },
      color: { value: null, confidence: "low", reason: "Not visible" },
      chassisLast4: { value: null, confidence: "low", reason: "Not visible" },
      engineLast4: { value: null, confidence: "low", reason: "Not visible" },
      policyholderName: { value: "Rahul Sharma", confidence: "high", reason: "Visible" },
      insurer: { value: "Acko", confidence: "medium", reason: "Visible" },
      policyType: { value: "Comprehensive", confidence: "medium", reason: "Visible" },
      policyNumber: { value: "POL123", confidence: "high", reason: "Visible" },
      idv: { value: "500000", confidence: "medium", reason: "Visible" },
      expiryIso: { value: "2026-09-18", confidence: "high", reason: "Visible" },
      holderName: { value: null, confidence: "low", reason: "Not a DL" },
      validUptoIso: { value: null, confidence: "low", reason: "Not a DL" },
      ...fields,
    },
  };
}

describe("ai-extract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_VISION_MODEL;
  });

  it("skips extraction when OPENAI_API_KEY is not configured", async () => {
    const result = await extractDocumentFieldsAi({
      documentType: "policy",
      ocrText: "policy text",
    });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("OPENAI_API_KEY is not configured");
  });

  it("calls Responses API with structured output and image input when provided", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_VISION_MODEL = "gpt-4o-mini";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify(mockOpenAiResponse()),
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractDocumentFieldsAi({
      documentType: "policy",
      ocrText: "policy text",
      imageBase64: "abc123",
      mimeType: "image/png",
    });

    expect(result.skipped).toBe(false);
    expect(fieldValue(result.extraction, "policyholderName")).toBe("Rahul Sharma");

    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.model).toBe("gpt-4o-mini");
    expect(request.text.format.type).toBe("json_schema");
    expect(request.text.format.strict).toBe(true);
    expect(request.text.format.schema.properties.fields.required).toEqual([
      ...new Set(request.text.format.schema.properties.fields.required),
    ]);
    expect(request.input[1].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "input_image",
          image_url: "data:image/png;base64,abc123",
        }),
      ]),
    );
  });

  it("does not return low-confidence field values", () => {
    const extraction = {
      fields: {
        policyholderName: {
          value: "Maybe Name",
          confidence: "low",
          reason: "unclear",
        },
      },
    };

    expect(fieldValue(extraction, "policyholderName")).toBeNull();
  });

  it("detects when AI extraction is needed", () => {
    expect(shouldUseAiExtraction(["OD02AB1234", "Rahul Sharma"])).toBe(false);
    expect(shouldUseAiExtraction(["OD02AB1234", null])).toBe(true);
    expect(shouldUseAiExtraction([""])).toBe(true);
  });
});
