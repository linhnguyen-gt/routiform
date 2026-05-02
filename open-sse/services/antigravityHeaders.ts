/**
 * Antigravity header utilities.
 *
 * Generates User-Agent strings and API client headers that match
 * the real Antigravity client flows.
 *
 * Based on CLIProxyAPI's misc/header_utils.go.
 */

const ANTIGRAVITY_VERSION = "1.107.0";

export const ANTIGRAVITY_CREDIT_PROBE_API_CLIENT = "google-genai-sdk/1.30.0 gl-node/v22.21.1";

/**
 * Antigravity User-Agent: "antigravity/VERSION darwin/arm64"
 *
 * Always claims darwin/arm64 regardless of actual server OS.
 * Real Antigravity is a macOS desktop tool — most users are on macOS.
 * Claiming linux/amd64 from a datacenter IP is MORE suspicious than
 * darwin/arm64. Matches CLIProxyAPI's proven production behavior.
 */
export function antigravityUserAgent(): string {
  return `antigravity/${ANTIGRAVITY_VERSION} darwin/arm64`;
}

export function googApiClientHeader(): string {
  return ANTIGRAVITY_CREDIT_PROBE_API_CLIENT;
}

export { ANTIGRAVITY_VERSION };
