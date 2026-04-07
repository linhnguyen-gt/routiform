#!/usr/bin/env node

import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import {
  resolveRuntimePorts,
  sanitizeColorEnv,
  spawnWithForwardedSignals,
  withRuntimePortEnv,
} from "./runtime-env.mjs";

const mode = process.argv[2] === "start" ? "start" : "dev";
const cwd = process.cwd();
const appDir = join(cwd, "app");
const srcAppDir = join(cwd, "src", "app");
const appPage = join(appDir, "page.tsx");
const backupDir = join(cwd, "app.__qa_backup");

let appDirMoved = false;

function shouldMoveAppDir() {
  return existsSync(appDir) && !existsSync(appPage) && existsSync(srcAppDir);
}

function prepareAppDir() {
  if (!shouldMoveAppDir()) return;

  if (existsSync(backupDir)) {
    console.warn(
      "[Playwright WebServer] app.__qa_backup already exists; leaving app/ in place. " +
        "If tests hit 404 on every route, clear app/ artifacts before running e2e."
    );
    return;
  }

  renameSync(appDir, backupDir);
  appDirMoved = true;
  console.log("[Playwright WebServer] Temporarily moved app/ to app.__qa_backup");
}

function restoreAppDir() {
  if (!appDirMoved) return;
  if (!existsSync(backupDir) || existsSync(appDir)) return;

  renameSync(backupDir, appDir);
  console.log("[Playwright WebServer] Restored app/ directory");
}

process.on("exit", restoreAppDir);
process.on("uncaughtException", (error) => {
  restoreAppDir();
  throw error;
});

prepareAppDir();

const runtimePorts = resolveRuntimePorts();
const testServerEnv = {
  ...sanitizeColorEnv(process.env),
  ROUTIFORM_DISABLE_TOKEN_HEALTHCHECK: process.env.ROUTIFORM_DISABLE_TOKEN_HEALTHCHECK || "1",
  ROUTIFORM_HIDE_HEALTHCHECK_LOGS: process.env.ROUTIFORM_HIDE_HEALTHCHECK_LOGS || "1",
};
const args = [
  "./node_modules/next/dist/bin/next",
  mode,
  "--port",
  String(runtimePorts.dashboardPort),
];
if (mode === "dev") {
  args.splice(2, 0, "--webpack");
}

spawnWithForwardedSignals(process.execPath, args, {
  stdio: "inherit",
  env: withRuntimePortEnv(testServerEnv, runtimePorts),
});
