#!/usr/bin/env node

const enabled = process.env.ENABLE_V1_WS_BRIDGE === "true";

if (!enabled) {
  console.error("[v1-ws-bridge] ENABLE_V1_WS_BRIDGE is not true; bridge is disabled.");
  process.exit(1);
}

console.log("[v1-ws-bridge] Optional bridge entrypoint detected.");
console.log("[v1-ws-bridge] In this phase, handshake validation is implemented in /api/v1/ws.");
console.log(
  "[v1-ws-bridge] Full ws->chat upgrade proxy runtime is deferred and must be validated before release."
);
