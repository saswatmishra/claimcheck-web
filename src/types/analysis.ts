export type RiskLevel = "GREEN" | "AMBER" | "RED";

export type Finding = {
  code: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
};

export type FixStep = {
  title: string;
  steps: string[];
};

export type AnalysisResult = {
  risk: RiskLevel;
  summary: string;
  findings: Finding[];
  fixes: FixStep[];
  checked?: { label: string; value: string }[];
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
  };

};

