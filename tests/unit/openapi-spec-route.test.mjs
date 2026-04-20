import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const route = await import("../../src/app/api/openapi/spec/route.ts");

test("resolveOpenApiSpecPath returns null when no candidate exists", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-openapi-spec-none-"));

  const resolved = route.resolveOpenApiSpecPath(baseDir);
  assert.equal(resolved, null);

  fs.rmSync(baseDir, { recursive: true, force: true });
});

test("resolveOpenApiSpecPath resolves public/docs fallback", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-openapi-spec-public-"));
  const publicDocsDir = path.join(baseDir, "public", "docs");
  const expectedPath = path.join(publicDocsDir, "openapi.yaml");

  fs.mkdirSync(publicDocsDir, { recursive: true });
  fs.writeFileSync(expectedPath, "openapi: 3.1.0\n");

  const resolved = route.resolveOpenApiSpecPath(baseDir);
  assert.equal(resolved, expectedPath);

  fs.rmSync(baseDir, { recursive: true, force: true });
});

test("resolveOpenApiSpecPath prefers docs/openapi.yaml over public/docs/openapi.yaml", () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-openapi-spec-priority-"));
  const docsDir = path.join(baseDir, "docs");
  const publicDocsDir = path.join(baseDir, "public", "docs");
  const docsPath = path.join(docsDir, "openapi.yaml");
  const publicPath = path.join(publicDocsDir, "openapi.yaml");

  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(publicDocsDir, { recursive: true });
  fs.writeFileSync(docsPath, "openapi: 3.1.0\n");
  fs.writeFileSync(publicPath, "openapi: 3.1.0\n");

  const resolved = route.resolveOpenApiSpecPath(baseDir);
  assert.equal(resolved, docsPath);

  fs.rmSync(baseDir, { recursive: true, force: true });
});
