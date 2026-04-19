export const ANTIGRAVITY_BASE_URLS = [
  "https://daily-cloudcode-pa.googleapis.com",
  "https://daily-cloudcode-pa.sandbox.googleapis.com",
  "https://cloudcode-pa.googleapis.com",
] as const;

export function getAntigravityModelsDiscoveryUrls(): string[] {
  return ANTIGRAVITY_BASE_URLS.map((base) => `${base}/v1internal:models`);
}
