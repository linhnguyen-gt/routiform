import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  computeTokensPerSecond,
  formatTokensPerSecondValue,
} from "../../src/shared/utils/formatting.ts";
import { buildExportText } from "../../src/shared/components/RequestLoggerV2.tsx";

const loggerV2Path = path.resolve("src/shared/components/RequestLoggerV2.tsx");
const loggerDetailPath = path.resolve("src/shared/components/RequestLoggerDetail.tsx");
const formattingPath = path.resolve("src/shared/utils/formatting.ts");

function readSource(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("formatting utils expose shared TPS helpers", () => {
  const source = readSource(formattingPath);

  assert.match(source, /export\s+function\s+computeTokensPerSecond\(/);
  assert.match(source, /export\s+function\s+formatTokensPerSecondValue\(/);
});

test("computeTokensPerSecond returns expected values and null boundaries", () => {
  assert.equal(computeTokensPerSecond(200, 1000), 200);
  assert.equal(computeTokensPerSecond(1, 1), 1000);
  assert.equal(computeTokensPerSecond(200, 0), null);
  assert.equal(computeTokensPerSecond(0, 1000), null);
  assert.equal(computeTokensPerSecond(-5, 1000), null);
});

test("formatTokensPerSecondValue formats values for display", () => {
  assert.equal(formatTokensPerSecondValue(null), "N/A");
  assert.equal(formatTokensPerSecondValue(0), "N/A");
  assert.equal(formatTokensPerSecondValue(12.345), "12.35 tok/s");
  assert.equal(formatTokensPerSecondValue(1200), "1,200 tok/s");
});

test("RequestLoggerV2 uses shared TPS helpers and render labels", () => {
  const source = readSource(loggerV2Path);

  assert.match(source, /computeTokensPerSecond/);
  assert.match(source, /formatTokensPerSecondValue/);
  assert.match(source, /\[TPS\]/);
  assert.match(source, />TPS:</);
});

test("RequestLoggerDetail uses shared TPS helpers and includes TPS badge", () => {
  const source = readSource(loggerDetailPath);

  assert.match(source, /computeTokensPerSecond/);
  assert.match(source, /formatTokensPerSecondValue/);
  assert.match(source, /\{formatTokensPerSecondValue\(tokensPerSecond\)\}\s+tok\/s/);
});

test("buildExportText preserves valid zero duration in export", () => {
  const log = {
    id: "log-1",
    timestamp: "2026-01-01T00:00:00.000Z",
    status: 200,
    provider: "openai",
    sourceFormat: "openai",
    model: "gpt-4o-mini",
    method: "POST",
    path: "/v1/chat/completions",
    duration: 0,
    tokens: { in: 10, out: 20 },
  };

  const exported = buildExportText(log, null);
  assert.match(exported, /\[Duration Ms\]\s+0/);
  assert.doesNotMatch(exported, /\[Duration Ms\]\s+-/);
});
