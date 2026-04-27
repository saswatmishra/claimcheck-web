import { getAppUrl } from "../config";
import type { AnalysisResult } from "../types/analysis";

const SHARE_VERSION = 1;

export type VehicleSharePayload = {
  v: typeof SHARE_VERSION;
  createdAt: string;
  regNumber?: string;
  nickname?: string;
  analysis: AnalysisResult;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return bytesToBase64(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return new TextDecoder().decode(base64ToBytes(padded));
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AnalysisResult>;
  return (
    (candidate.risk === "GREEN" ||
      candidate.risk === "AMBER" ||
      candidate.risk === "RED") &&
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.findings) &&
    Array.isArray(candidate.fixes)
  );
}

export function createVehicleShareId(
  analysis: AnalysisResult,
  details: { regNumber?: string; nickname?: string } = {},
): string {
  const payload: VehicleSharePayload = {
    v: SHARE_VERSION,
    createdAt: new Date().toISOString(),
    analysis,
  };

  if (details.regNumber?.trim()) payload.regNumber = details.regNumber.trim();
  if (details.nickname?.trim()) payload.nickname = details.nickname.trim();

  return toBase64Url(JSON.stringify(payload));
}

export function parseVehicleShareId(id: string): VehicleSharePayload | null {
  try {
    const decoded = fromBase64Url(decodeURIComponent(id));
    const parsed = JSON.parse(decoded) as Partial<VehicleSharePayload>;

    if (parsed.v !== SHARE_VERSION) return null;
    if (typeof parsed.createdAt !== "string") return null;
    if (!isAnalysisResult(parsed.analysis)) return null;

    return {
      v: SHARE_VERSION,
      createdAt: parsed.createdAt,
      regNumber:
        typeof parsed.regNumber === "string" ? parsed.regNumber : undefined,
      nickname: typeof parsed.nickname === "string" ? parsed.nickname : undefined,
      analysis: parsed.analysis,
    };
  } catch {
    return null;
  }
}

export function getVehicleSharePath(
  analysis: AnalysisResult,
  details: { regNumber?: string; nickname?: string } = {},
): string {
  return `/v/${createVehicleShareId(analysis, details)}`;
}

export function getVehicleShareUrl(
  analysis: AnalysisResult,
  details: { regNumber?: string; nickname?: string } = {},
): string {
  return getAppUrl(getVehicleSharePath(analysis, details));
}
