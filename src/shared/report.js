const riskLevels = ["GREEN", "AMBER", "RED"];
const isString = (value) => typeof value === "string";
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function isAnalysisResult(value) {
  if (!isObject(value)) return false;
  if (!riskLevels.includes(value.risk) || !isString(value.summary)) return false;
  if (!Array.isArray(value.findings) || !value.findings.every((item) =>
    isObject(item) && isString(item.code) && isString(item.title) &&
    isString(item.detail) && riskLevels.includes(item.severity))) return false;
  if (!Array.isArray(value.fixes) || !value.fixes.every((item) =>
    isObject(item) && isString(item.title) && Array.isArray(item.steps) &&
    item.steps.every(isString))) return false;
  for (const key of ["headline", "whyThisRisk", "disclaimer", "checkedAt"]) {
    if (value[key] !== undefined && !isString(value[key])) return false;
  }
  if (value.isDemo !== undefined && typeof value.isDemo !== "boolean") return false;
  if (value.checked !== undefined && (!Array.isArray(value.checked) ||
    !value.checked.every((item) => isObject(item) && isString(item.label) && isString(item.value)))) return false;
  if (value.documents !== undefined && (!Array.isArray(value.documents) ||
    !value.documents.every((item) => isObject(item) && isString(item.label) &&
      ["UPLOADED", "NOT_UPLOADED", "NOT_REQUIRED", "NOT_CHECKED"].includes(item.status) &&
      (item.note === undefined || isString(item.note))))) return false;
  if (value.extracted !== undefined) {
    if (!isObject(value.extracted)) return false;
    for (const key of ["rc", "policy", "dl"]) {
      const fields = value.extracted[key];
      if (fields === undefined) continue;
      if (!isObject(fields)) return false;
      if (!Object.entries(fields).every(([name, field]) =>
        name === "provided" ? typeof field === "boolean" : field === null || isString(field))) return false;
    }
  }
  return true;
}
