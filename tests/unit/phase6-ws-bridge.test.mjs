import test from "node:test";
import assert from "node:assert/strict";

const { validateWsHandshake } = await import("../../src/lib/ws/handshake.ts");
const wsRoute = await import("../../src/app/api/v1/ws/route.ts");

function makeWsRequest(headers = {}) {
  return new Request("http://localhost/api/v1/ws", {
    method: "GET",
    headers,
  });
}

test("phase6 ws route is disabled by default", async () => {
  delete process.env.ENABLE_V1_WS_BRIDGE;

  const response = await wsRoute.GET(makeWsRequest());
  assert.equal(response.status, 404);
});

test("phase6 handshake fails missing websocket upgrade header", async () => {
  const response = await validateWsHandshake(
    makeWsRequest({
      Connection: "Upgrade",
      "Sec-WebSocket-Version": "13",
      "Sec-WebSocket-Key": "123456789012345678901234",
      "Sec-WebSocket-Protocol": "openai-realtime-v1",
    }),
    async () => true
  );

  assert.equal(response.ok, false);
  assert.equal(response.status, 426);
});

test("phase6 handshake fails unauthorized", async () => {
  const response = await validateWsHandshake(
    makeWsRequest({
      Upgrade: "websocket",
      Connection: "Upgrade",
      "Sec-WebSocket-Version": "13",
      "Sec-WebSocket-Key": "123456789012345678901234",
      "Sec-WebSocket-Protocol": "openai-realtime-v1",
    }),
    async () => false
  );

  assert.equal(response.ok, false);
  assert.equal(response.status, 401);
});

test("phase6 handshake fails protocol denylist behavior", async () => {
  const originalAllowlist = process.env.V1_WS_PROTOCOL_ALLOWLIST;
  process.env.V1_WS_PROTOCOL_ALLOWLIST = "openai-realtime-v1";

  const response = await validateWsHandshake(
    makeWsRequest({
      Upgrade: "websocket",
      Connection: "Upgrade",
      "Sec-WebSocket-Version": "13",
      "Sec-WebSocket-Key": "123456789012345678901234",
      "Sec-WebSocket-Protocol": "not-allowed-v1",
    }),
    async () => true
  );

  assert.equal(response.ok, false);
  assert.equal(response.status, 403);

  if (originalAllowlist === undefined) delete process.env.V1_WS_PROTOCOL_ALLOWLIST;
  else process.env.V1_WS_PROTOCOL_ALLOWLIST = originalAllowlist;
});

test("phase6 handshake succeeds with allowlisted protocol", async () => {
  const originalAllowlist = process.env.V1_WS_PROTOCOL_ALLOWLIST;
  process.env.V1_WS_PROTOCOL_ALLOWLIST = "openai-realtime-v1,custom-protocol";

  const response = await validateWsHandshake(
    makeWsRequest({
      Upgrade: "websocket",
      Connection: "keep-alive, Upgrade",
      "Sec-WebSocket-Version": "13",
      "Sec-WebSocket-Key": "123456789012345678901234",
      "Sec-WebSocket-Protocol": "custom-protocol,other-protocol",
    }),
    async () => true
  );

  assert.equal(response.ok, true);
  assert.equal(response.status, 200);
  assert.equal(response.acceptedProtocol, "custom-protocol");

  if (originalAllowlist === undefined) delete process.env.V1_WS_PROTOCOL_ALLOWLIST;
  else process.env.V1_WS_PROTOCOL_ALLOWLIST = originalAllowlist;
});

test("phase6 route enforces handshake validation when enabled", async () => {
  const originalEnabled = process.env.ENABLE_V1_WS_BRIDGE;

  process.env.ENABLE_V1_WS_BRIDGE = "true";

  const response = await wsRoute.GET(makeWsRequest({ Connection: "Upgrade" }));

  assert.equal(response.status, 426);

  if (originalEnabled === undefined) delete process.env.ENABLE_V1_WS_BRIDGE;
  else process.env.ENABLE_V1_WS_BRIDGE = originalEnabled;
});
