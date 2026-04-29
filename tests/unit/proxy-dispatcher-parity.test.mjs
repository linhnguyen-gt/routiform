import test from "node:test";
import assert from "node:assert/strict";

const { getProxyDispatcherOptions, getDefaultDispatcher } =
  await import("../../open-sse/utils/proxyDispatcher.ts");

test("getProxyDispatcherOptions disables pipelining for proxy stability", () => {
  const opts = getProxyDispatcherOptions();
  assert.equal(opts.pipelining, 0);
  assert.ok(typeof opts.headersTimeout === "number");
  assert.ok(typeof opts.connectTimeout === "number");
});

test("default direct dispatcher is distinct export (proxy options not applied globally)", () => {
  const d = getDefaultDispatcher();
  assert.ok(d != null);
});
