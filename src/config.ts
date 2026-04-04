const APP_ORIGIN = "https://claimcheck.co.in";

export const APP_CONFIG = {
  appOrigin: APP_ORIGIN,
  appName: "ClaimCheck",
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001",
} as const;

export function getAppUrl(path = "/") {
  return new URL(path, APP_ORIGIN).toString();
}
