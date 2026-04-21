export type RiskLevel = "GREEN" | "AMBER" | "RED";

export type Finding = {
  code: string;
  title: string;
  detail: string;
  severity: RiskLevel;
};

export type FixStep = {
  title: string;
  steps: string[];
};

export type DocumentStatus = {
  label: string;
  status: "UPLOADED" | "NOT_UPLOADED" | "NOT_REQUIRED";
  note?: string;
};

export type AnalysisResult = {
  isDemo?: boolean;
  risk: RiskLevel;
  headline?: string;
  summary: string;
  whyThisRisk?: string;
  findings: Finding[];
  fixes: FixStep[];
  checked?: { label: string; value: string }[];
  documents?: DocumentStatus[];
  disclaimer?: string;
  extracted?: {
    rc?: { vehicleNumber?: string };
    policy?: {
      insurer?: string;
      policyType?: string;
      policyNumber?: string;
      idv?: string;
      expiryIso?: string | null;
      vehicleNumber?: string;
    };
    dl?: {
      provided?: boolean;
      holderName?: string | null;
      validUptoIso?: string | null;
      validUpto?: string | null;
    };
  };
};
