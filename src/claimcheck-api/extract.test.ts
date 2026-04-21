import { describe, expect, it } from "vitest";
import {
  extractDlHolderName,
  extractDlValidUptoISO,
  extractExpiryDateISO,
  extractInsurer,
  extractPolicyType,
  extractPolicyholderName,
  extractVehicleNumber,
} from "./extract.js";

describe("claimcheck-api extractors", () => {
  it("extracts normalized vehicle number", () => {
    expect(extractVehicleNumber("Reg No: OD 02 AB 1234")).toBe("OD02AB1234");
  });

  it("extracts policy expiry ISO from common format", () => {
    const text = "Period of Insurance From:01/01/2026 To:24/12/2026";
    expect(extractExpiryDateISO(text)).toBe("2026-12-24");
  });

  it("extracts policyholder name from ACKO style", () => {
    const text = "Car Owner Rohit Sharma Policy Starts 2025-01-01";
    expect(extractPolicyholderName(text)).toBe("Rohit Sharma");
  });

  it("extracts policy type reliably", () => {
    expect(extractPolicyType("Private Car Comprehensive Plan")).toBe("Comprehensive");
    expect(extractPolicyType("Third Party Only Liability Policy")).toBe("Act Only");
  });

  it("extracts insurer reliably", () => {
    expect(extractInsurer("Issued by ICICI Lombard General Insurance")).toBe(
      "ICICI Lombard",
    );
  });

  it("extracts DL holder from Odisha style", () => {
    const dlText = `OR02K19990011005\n: BABA BISWANATH MISHRA\nDOB\n01/01/1980`;
    expect(extractDlHolderName(dlText)).toBe("Baba Biswanath Mishra");
  });

  it("extracts DL validity date with keyword and fallback latest date", () => {
    expect(extractDlValidUptoISO("Valid Upto: 24/12/2030")).toBe("2030-12-24");
    expect(
      extractDlValidUptoISO("DOB 01/01/1985 Issued 01/01/2020 Expiry 05/08/2035"),
    ).toBe("2035-08-05");
  });
});
