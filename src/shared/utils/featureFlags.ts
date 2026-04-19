export function isCcCompatibleProviderEnabled() {
  return process.env.ENABLE_CC_COMPATIBLE_PROVIDER === "true";
}

export function isPerplexityWebProviderEnabled() {
  return process.env.ENABLE_PERPLEXITY_WEB_PROVIDER === "true";
}

export function isGrokWebProviderEnabled() {
  return process.env.ENABLE_GROK_WEB_PROVIDER === "true";
}

export function isV1WsBridgeEnabled() {
  return process.env.ENABLE_V1_WS_BRIDGE === "true";
}
