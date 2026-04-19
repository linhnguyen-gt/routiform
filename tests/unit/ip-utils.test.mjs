import test from "node:test";
import assert from "node:assert/strict";

import { extractClientIp, getClientIpFromRequest } from "../../src/lib/ipUtils.ts";

test("extractClientIp returns first valid IP from x-forwarded-for", () => {
  const result = extractClientIp("unknown, 10.0.0.1, 203.0.113.5", undefined);
  assert.equal(result, "10.0.0.1");
});

test("getClientIpFromRequest falls back to x-real-ip when x-forwarded-for is invalid", () => {
  const headers = new Headers({
    "x-forwarded-for": "unknown,not-an-ip",
    "x-real-ip": "203.0.113.7",
  });

  const result = getClientIpFromRequest({ headers });
  assert.equal(result, "203.0.113.7");
});

test("getClientIpFromRequest prefers cf-connecting-ip", () => {
  const headers = new Headers({
    "cf-connecting-ip": "198.51.100.10",
    "x-forwarded-for": "203.0.113.8",
    "x-real-ip": "203.0.113.9",
  });

  const result = getClientIpFromRequest({ headers });
  assert.equal(result, "198.51.100.10");
});
