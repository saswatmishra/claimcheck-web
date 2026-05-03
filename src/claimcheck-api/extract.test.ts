import { describe, expect, it } from "vitest";
import {
  extractDlHolderName,
  extractDlValidUptoISO,
  extractExpiryDateISO,
  extractInsurer,
  extractPolicyIdv,
  extractPolicyNumber,
  extractPolicyType,
  extractPolicyholderName,
  extractRcChassisLast4,
  extractRcColor,
  extractRcEngineLast4,
  extractRcFuel,
  extractRcMakeModel,
  extractRcOwnerName,
  extractRcYear,
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

  it("extracts Tata AIG policy schedule fields", () => {
    const policyText = `
      Policy No.: 3754343543 Insurer Name: Tata AIG General Insurance Co. Ltd.
      Vehicle Registration: OD 02 CH 0323 Vehicle IDV: Rs.695708
      Coverage: Auto Secure - Private Car Package Policy
      Insured's Name : MR. BISWAJIT ACHARYA
      Period of Own Damage : From04-Apr-2026(00:00:00) To 03-Apr-2027(Midnight)
    `;

    expect(extractVehicleNumber(policyText)).toBe("OD02CH0323");
    expect(extractPolicyholderName(policyText)).toBe("BISWAJIT ACHARYA");
    expect(extractExpiryDateISO(policyText)).toBe("2027-04-03");
    expect(extractPolicyType(policyText)).toBe("Comprehensive");
    expect(extractPolicyNumber(policyText)).toBe("3754343543");
    expect(extractPolicyIdv(policyText)).toBe("INR 6,95,708");
    expect(extractInsurer(policyText)).toBe("Tata AIG");
  });

  it("extracts Odisha mParivahan RC label variants", () => {
    const rcText = `
      REG NO : OD02CH0323
      CH NO : MZBFF811VPN287690
      E SNO : G3LCPM828335
      REGD DT : 05-Apr-2023
      NAME : BISWAJIT ACHARYA
      MODEL : SONET G1.0T 7DCT HTX
      FUEL : PETROL
      COLOR : IMPERIAL BLUE
    `;

    expect(extractVehicleNumber(rcText)).toBe("OD02CH0323");
    expect(extractRcOwnerName(rcText)).toBe("BISWAJIT ACHARYA");
    expect(extractRcMakeModel(rcText)).toBe("SONET G1.0T 7DCT HTX");
    expect(extractRcFuel(rcText)).toBe("Petrol");
    expect(extractRcYear(rcText)).toBe("2023");
    expect(extractRcColor(rcText)).toBe("IMPERIAL BLUE");
    expect(extractRcChassisLast4(rcText)).toBe("7690");
    expect(extractRcEngineLast4(rcText)).toBe("8335");
  });

  it("extracts RC owner when OCR splits the name label and value", () => {
    expect(
      extractRcOwnerName(`
        VHE CL
        : Motor Car(LMV)
        NAME
        : BISWAJIT ACHARYA
        S/W/D
        : PRAFULLA CHANDRA ACHARYA
      `),
    ).toBe("BISWAJIT ACHARYA");

    expect(
      extractRcOwnerName(`
        REG NO : OD02CH0323
        NAME BISWAJIT ACHARYA S/W/D PRAFULLA CHANDRA ACHARYA
        Address : PLOT NO-34/35
      `),
    ).toBe("BISWAJIT ACHARYA");
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
