import { isV1WsBridgeEnabled } from "@/shared/utils/featureFlags";

declare global {
  var __routiformWsBridgeRuntimeInitialized: boolean | undefined;
}

export function initWsBridgeRuntime(): void {
  if (globalThis.__routiformWsBridgeRuntimeInitialized) return;
  globalThis.__routiformWsBridgeRuntimeInitialized = true;

  if (!isV1WsBridgeEnabled()) {
    return;
  }

  console.log(
    "[WS Bridge] ENABLE_V1_WS_BRIDGE=true. Handshake route is active at /api/v1/ws; runtime upgrade bridge remains external via scripts/v1-ws-bridge.mjs"
  );
}
