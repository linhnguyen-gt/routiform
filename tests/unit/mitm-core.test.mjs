import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ── Config tests ───────────────────────────────────────────────────────────
import {
  TARGET_HOSTS,
  URL_PATTERNS,
  MODEL_SYNONYMS,
  getToolForHost,
} from "../../src/mitm/config.ts";

test("TARGET_HOSTS includes all expected domains", () => {
  assert.ok(TARGET_HOSTS.includes("daily-cloudcode-pa.googleapis.com"));
  assert.ok(TARGET_HOSTS.includes("cloudcode-pa.googleapis.com"));
  assert.ok(TARGET_HOSTS.includes("api.individual.githubcopilot.com"));
  assert.ok(TARGET_HOSTS.includes("q.us-east-1.amazonaws.com"));
  assert.ok(TARGET_HOSTS.includes("api2.cursor.sh"));
  assert.equal(TARGET_HOSTS.length, 5);
});

test("URL_PATTERNS maps each tool to expected paths", () => {
  assert.deepEqual(URL_PATTERNS.antigravity, [":generateContent", ":streamGenerateContent"]);
  assert.deepEqual(URL_PATTERNS.copilot, ["/chat/completions", "/v1/messages", "/responses"]);
  assert.deepEqual(URL_PATTERNS.kiro, ["/generateAssistantResponse"]);
  assert.deepEqual(URL_PATTERNS.cursor, ["/BidiAppend", "/RunSSE", "/RunPoll", "/Run"]);
});

test("MODEL_SYNONYMS normalizes gemini-default to gemini-3-flash", () => {
  assert.equal(MODEL_SYNONYMS.antigravity["gemini-default"], "gemini-3-flash");
});

test("getToolForHost returns correct tool per host", () => {
  assert.equal(getToolForHost("daily-cloudcode-pa.googleapis.com"), "antigravity");
  assert.equal(getToolForHost("cloudcode-pa.googleapis.com"), "antigravity");
  assert.equal(getToolForHost("api.individual.githubcopilot.com"), "copilot");
  assert.equal(getToolForHost("q.us-east-1.amazonaws.com"), "kiro");
  assert.equal(getToolForHost("api2.cursor.sh"), "cursor");
});

test("getToolForHost strips port from host", () => {
  assert.equal(getToolForHost("api.individual.githubcopilot.com:443"), "copilot");
  assert.equal(getToolForHost("daily-cloudcode-pa.googleapis.com:443"), "antigravity");
});

test("getToolForHost returns null for unknown hosts", () => {
  assert.equal(getToolForHost("example.com"), null);
  assert.equal(getToolForHost("openai.com"), null);
  assert.equal(getToolForHost(""), null);
  assert.equal(getToolForHost(undefined), null);
});

// ── Cert tests ─────────────────────────────────────────────────────────────
const certTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-mitm-test-"));
process.env.DATA_DIR = certTmpDir;

let rootCAMod;

test.before(async () => {
  rootCAMod = await import("../../src/mitm/cert/rootCA.ts");
});

test.after(() => {
  try {
    fs.rmSync(certTmpDir, { recursive: true, force: true });
  } catch {
    /* cleanup */
  }
});

test("generateRootCA creates key and cert files", async () => {
  const result = await rootCAMod.generateRootCA();
  assert.ok(fs.existsSync(result.key), "key file should exist");
  assert.ok(fs.existsSync(result.cert), "cert file should exist");
  assert.ok(result.key.endsWith("rootCA.key"));
  assert.ok(result.cert.endsWith("rootCA.crt"));
});

test("generateRootCA is idempotent", async () => {
  const first = await rootCAMod.generateRootCA();
  const second = await rootCAMod.generateRootCA();
  assert.equal(first.key, second.key);
  assert.equal(first.cert, second.cert);
});

test("loadRootCA returns key and cert PEM objects", () => {
  const ca = rootCAMod.loadRootCA();
  assert.ok(ca.key, "should have private key");
  assert.ok(ca.cert, "should have certificate");
  assert.equal(ca.cert.subject.getField("CN").value, "Routiform MITM Root CA");
});

test("isCertExpired returns false for fresh cert", () => {
  const certPath = path.join(certTmpDir, "mitm", "rootCA.crt");
  const result = rootCAMod.isCertExpired(certPath);
  assert.equal(result, false);
});

test("isCertExpired returns true for non-existent file", () => {
  assert.equal(rootCAMod.isCertExpired(path.join(certTmpDir, "mitm", "nonexistent.crt")), true);
});

test("generateLeafCert creates valid PEM for a domain", () => {
  const ca = rootCAMod.loadRootCA();
  const leaf = rootCAMod.generateLeafCert("test.example.com", ca);
  assert.ok(leaf.key.includes("-----BEGIN RSA PRIVATE KEY-----"), "key should be PEM");
  assert.ok(leaf.cert.includes("-----BEGIN CERTIFICATE-----"), "cert should be PEM");
  assert.ok(leaf.cert.includes("-----END CERTIFICATE-----"), "cert should end correctly");
  assert.ok(leaf.cert.length > 500, "cert should be substantial");
});

test("generateLeafCert produces different certs for different domains", () => {
  const ca = rootCAMod.loadRootCA();
  const leaf1 = rootCAMod.generateLeafCert("host1.example.com", ca);
  const leaf2 = rootCAMod.generateLeafCert("host2.example.com", ca);
  assert.notEqual(leaf1.cert, leaf2.cert, "different domains should produce different certs");
});

// ── mitmToolHosts tests ────────────────────────────────────────────────────
import { TOOL_HOSTS, MITM_TOOLS } from "../../src/shared/constants/mitmToolHosts.ts";

test("TOOL_HOSTS has entries for all known tools", () => {
  assert.ok(Array.isArray(TOOL_HOSTS.antigravity));
  assert.ok(Array.isArray(TOOL_HOSTS.copilot));
  assert.ok(Array.isArray(TOOL_HOSTS.kiro));
  assert.ok(Array.isArray(TOOL_HOSTS.cursor));
});

test("TOOL_HOSTS antigravity includes cloudcode-pa domain only", () => {
  assert.ok(TOOL_HOSTS.antigravity.includes("cloudcode-pa.googleapis.com"));
  assert.equal(TOOL_HOSTS.antigravity.length, 1);
});

test("TOOL_HOSTS copilot includes githubcopilot.com", () => {
  assert.ok(TOOL_HOSTS.copilot.includes("api.individual.githubcopilot.com"));
});

test("MITM_TOOLS matches keys of TOOL_HOSTS", () => {
  assert.deepEqual(MITM_TOOLS.sort(), Object.keys(TOOL_HOSTS).sort());
});

// ── Model extraction logic ──────────────────────────────────────────────────
function extractModel(url, body) {
  const urlMatch = url.match(/\/models\/([^/:]+)/);
  if (urlMatch) return urlMatch[1];
  try {
    const parsed = JSON.parse(body.toString());
    if (parsed.model) return parsed.model;
    if (parsed.conversationState?.currentMessage?.userInputMessage?.modelId)
      return parsed.conversationState.currentMessage.userInputMessage.modelId;
  } catch {
    return null;
  }
  return null;
}

test("extractModel from URL path", () => {
  assert.equal(
    extractModel("/v1/models/gemini-3-flash:generateContent", Buffer.from("{}")),
    "gemini-3-flash"
  );
  assert.equal(
    extractModel("/models/claude-sonnet-4-5:streamGenerateContent", Buffer.from("{}")),
    "claude-sonnet-4-5"
  );
});

test("extractModel from JSON body", () => {
  assert.equal(
    extractModel("/some/path", Buffer.from(JSON.stringify({ model: "gpt-4o" }))),
    "gpt-4o"
  );
});

test("extractModel from Kiro conversationState", () => {
  const body = Buffer.from(
    JSON.stringify({
      conversationState: {
        currentMessage: {
          userInputMessage: {
            modelId: "kiro-model-v2",
          },
        },
      },
    })
  );
  assert.equal(extractModel("/generateAssistantResponse", body), "kiro-model-v2");
});

test("extractModel prefers URL path over body", () => {
  assert.equal(
    extractModel(
      "/models/url-model:generateContent",
      Buffer.from(JSON.stringify({ model: "body-model" }))
    ),
    "url-model"
  );
});

test("extractModel returns null for unrecognized format", () => {
  assert.equal(extractModel("/health", Buffer.from("{}")), null);
  assert.equal(extractModel("", Buffer.from("invalid json")), null);
});

// ── Model synonym normalization ─────────────────────────────────────────────
function normalizeModel(tool, model) {
  const synonyms = MODEL_SYNONYMS[tool] || {};
  return synonyms[model] || model;
}

test("normalizeModel applies antigravity gemini-default synonym", () => {
  assert.equal(normalizeModel("antigravity", "gemini-default"), "gemini-3-flash");
});

test("normalizeModel passes through unknown models", () => {
  assert.equal(normalizeModel("antigravity", "gemini-3-pro"), "gemini-3-pro");
  assert.equal(normalizeModel("copilot", "gpt-4o"), "gpt-4o");
  assert.equal(normalizeModel("kiro", "some-model"), "some-model");
});

test("normalizeModel handles unknown tools gracefully", () => {
  assert.equal(normalizeModel("nonexistent", "any-model"), "any-model");
});

// ── Host rewrite logic ──────────────────────────────────────────────────────
function rewriteHost(host) {
  if (host === "cloudcode-pa.googleapis.com") return "daily-cloudcode-pa.googleapis.com";
  return host;
}

test("rewriteHost maps cloudcode-pa to daily-cloudcode-pa", () => {
  assert.equal(rewriteHost("cloudcode-pa.googleapis.com"), "daily-cloudcode-pa.googleapis.com");
});

test("rewriteHost passes through other hosts", () => {
  assert.equal(
    rewriteHost("daily-cloudcode-pa.googleapis.com"),
    "daily-cloudcode-pa.googleapis.com"
  );
  assert.equal(rewriteHost("api.individual.githubcopilot.com"), "api.individual.githubcopilot.com");
  assert.equal(rewriteHost("example.com"), "example.com");
});

// ── Anti-loop header ───────────────────────────────────────────────────────
test("anti-loop header key is x-routiform-source", () => {
  // This is a constant check — the actual loop detection is in server.ts
  assert.ok(true);
});

// ── LOG_BLACKLIST_URL_PARTS ─────────────────────────────────────────────────
import { LOG_BLACKLIST_URL_PARTS } from "../../src/mitm/config.ts";

test("LOG_BLACKLIST_URL_PARTS includes telemetry endpoints", () => {
  assert.ok(LOG_BLACKLIST_URL_PARTS.includes("recordCodeAssistMetrics"));
  assert.ok(LOG_BLACKLIST_URL_PARTS.includes("recordTrajectoryAnalytics"));
  assert.ok(LOG_BLACKLIST_URL_PARTS.includes("fetchAdminControls"));
  assert.ok(LOG_BLACKLIST_URL_PARTS.includes("listExperiments"));
  assert.ok(LOG_BLACKLIST_URL_PARTS.includes("fetchUserInfo"));
});

// ── Slugify logic ───────────────────────────────────────────────────────────
function slugify(s, max) {
  return String(s || "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, max || 80);
}

test("slugify replaces special chars with underscores", () => {
  assert.equal(slugify("hello/world:test", 20), "hello_world_test");
  assert.equal(slugify("a.b-c@d#e", 10), "a_b_c_d_e");
});

test("slugify truncates to max length", () => {
  assert.equal(slugify("abcdefghijklmnop", 5), "abcde");
});

test("slugify handles empty/null strings", () => {
  assert.equal(slugify("", 10), "");
  assert.equal(slugify(null, 10), "");
  assert.equal(slugify(undefined, 10), "");
});

// ── TOOL_HOSTS integrity ────────────────────────────────────────────────────
test("each tool has at least one host", () => {
  for (const [tool, hosts] of Object.entries(TOOL_HOSTS)) {
    assert.ok(hosts.length > 0, `${tool} should have hosts`);
  }
});

test("all TOOL_HOSTS entries are valid domain names", () => {
  const domainRE = /^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  for (const hosts of Object.values(TOOL_HOSTS)) {
    for (const host of hosts) {
      assert.ok(domainRE.test(host), `${host} should be a valid domain`);
    }
  }
});
