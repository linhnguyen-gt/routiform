import test from "node:test";
import assert from "node:assert/strict";
const {
  assertSafeOutboundUrl,
  safeOutboundFetch,
  isOutboundUrlPolicyError,
  setSafeOutboundDnsLookupForTesting,
  resetSafeOutboundDnsLookupForTesting,
} = await import("../../src/lib/network/safeOutboundFetch.ts");

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  resetSafeOutboundDnsLookupForTesting();
});

test("assertSafeOutboundUrl blocks localhost and private CIDRs", () => {
  assert.throws(() => assertSafeOutboundUrl("http://localhost:3000/models"), {
    name: "OutboundUrlPolicyError",
  });
  assert.throws(() => assertSafeOutboundUrl("http://127.0.0.1:8000"), {
    name: "OutboundUrlPolicyError",
  });
  assert.throws(() => assertSafeOutboundUrl("http://192.168.1.10/api"), {
    name: "OutboundUrlPolicyError",
  });
  assert.throws(() => assertSafeOutboundUrl("http://169.254.169.254/latest/meta-data"), {
    name: "OutboundUrlPolicyError",
  });
});

test("assertSafeOutboundUrl allows public https targets", () => {
  const url = assertSafeOutboundUrl("https://api.openai.com/v1/models");
  assert.equal(url.hostname, "api.openai.com");
});

test("assertSafeOutboundUrl allows localhost when loopback is explicitly allowed", () => {
  const url = assertSafeOutboundUrl("http://localhost:8317/v1/models", { allowLoopback: true });
  assert.equal(url.hostname, "localhost");
});

test("safeOutboundFetch rejects blocked targets before fetch execution", async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response("ok", { status: 200 });
  };

  await assert.rejects(
    async () => {
      await safeOutboundFetch("http://localhost:3000/v1/models");
    },
    (error) => {
      assert.equal(isOutboundUrlPolicyError(error), true);
      return true;
    }
  );

  assert.equal(fetchCalled, false);
});

test("safeOutboundFetch blocks hostnames that resolve to private addresses", async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response("ok", { status: 200 });
  };

  setSafeOutboundDnsLookupForTesting(async () => [{ address: "127.0.0.1", family: 4 }]);

  await assert.rejects(
    async () => {
      await safeOutboundFetch("https://public.example.com/v1/models");
    },
    (error) => {
      assert.equal(isOutboundUrlPolicyError(error), true);
      assert.match(String(error?.message || ""), /DNS resolved to private\/internal address/i);
      return true;
    }
  );

  assert.equal(fetchCalled, false);
});

test("assertSafeOutboundUrl blocks IPv4-mapped IPv6 loopback", () => {
  assert.throws(() => assertSafeOutboundUrl("http://[::ffff:127.0.0.1]:8080/v1/models"), {
    name: "OutboundUrlPolicyError",
  });
});

test("assertSafeOutboundUrl blocks expanded IPv6 loopback", () => {
  assert.throws(() => assertSafeOutboundUrl("http://[0:0:0:0:0:0:0:1]:8080/v1/models"), {
    name: "OutboundUrlPolicyError",
  });
});

test("safeOutboundFetch blocks redirect to private target before follow-up request", async () => {
  setSafeOutboundDnsLookupForTesting(async () => [{ address: "93.184.216.34", family: 4 }]);
  let fetchCalled = 0;
  globalThis.fetch = async (input) => {
    fetchCalled += 1;
    assert.equal(String(input), "https://api.example.com/v1/models");
    return new Response("redirect", {
      status: 302,
      headers: { location: "http://127.0.0.1:8080/internal" },
    });
  };

  await assert.rejects(
    async () => {
      await safeOutboundFetch("https://api.example.com/v1/models", {}, { retries: 0 });
    },
    (error) => {
      assert.equal(isOutboundUrlPolicyError(error), true);
      assert.match(String(error?.message || ""), /private\/internal target/i);
      return true;
    }
  );

  assert.equal(fetchCalled, 1);
});

test("safeOutboundFetch follows safe redirect chain", async () => {
  setSafeOutboundDnsLookupForTesting(async (hostname) => {
    if (hostname === "api.example.com") {
      return [{ address: "93.184.216.34", family: 4 }];
    }
    if (hostname === "cdn.example.com") {
      return [{ address: "93.184.216.35", family: 4 }];
    }
    throw new Error("unexpected host");
  });

  let fetchCalled = 0;
  globalThis.fetch = async (input) => {
    fetchCalled += 1;
    if (fetchCalled === 1) {
      assert.equal(String(input), "https://api.example.com/v1/models");
      return new Response("redirect", {
        status: 302,
        headers: { location: "https://cdn.example.com/v1/models" },
      });
    }
    assert.equal(fetchCalled, 2);
    assert.equal(String(input), "https://cdn.example.com/v1/models");
    return new Response("ok", { status: 200 });
  };

  const response = await safeOutboundFetch("https://api.example.com/v1/models", {}, { retries: 0 });
  assert.equal(response.status, 200);
  assert.equal(fetchCalled, 2);
});
