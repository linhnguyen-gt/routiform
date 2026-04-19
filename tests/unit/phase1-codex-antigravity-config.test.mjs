import test from "node:test";
import assert from "node:assert/strict";

test("Phase1: codex default headers sanitize env overrides", async () => {
  const oldVersion = process.env.CODEX_CLIENT_VERSION;
  const oldUa = process.env.CODEX_USER_AGENT;

  process.env.CODEX_CLIENT_VERSION = " 1.2.3\n";
  process.env.CODEX_USER_AGENT = "codex-cli/custom\r\nagent";

  const modulePath = "../../open-sse/config/codexClient.ts";
  const { getCodexDefaultHeaders } = await import(`${modulePath}?t=${Date.now()}`);
  const headers = getCodexDefaultHeaders();

  assert.equal(headers.Version, "1.2.3");
  assert.equal(headers["Openai-Beta"], "responses=experimental");
  assert.equal(headers["User-Agent"], "codex-cli/custom agent");

  if (oldVersion === undefined) delete process.env.CODEX_CLIENT_VERSION;
  else process.env.CODEX_CLIENT_VERSION = oldVersion;

  if (oldUa === undefined) delete process.env.CODEX_USER_AGENT;
  else process.env.CODEX_USER_AGENT = oldUa;
});

test("Phase1: antigravity discovery URLs are derived from base URL list", async () => {
  const { ANTIGRAVITY_BASE_URLS, getAntigravityModelsDiscoveryUrls } =
    await import("../../open-sse/config/antigravityUpstream.ts");

  const urls = getAntigravityModelsDiscoveryUrls();
  assert.equal(urls.length, ANTIGRAVITY_BASE_URLS.length);
  for (let i = 0; i < ANTIGRAVITY_BASE_URLS.length; i++) {
    assert.equal(urls[i], `${ANTIGRAVITY_BASE_URLS[i]}/v1internal:models`);
  }
});
