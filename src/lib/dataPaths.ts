import path from "path";
import os from "os";
import fs from "fs";

export const APP_NAME = "routiform";
/** Prior default folder name; migrations and legacy paths still reference `~/.omniroute` (etc.). */
export const LEGACY_APP_NAME = "omniroute";

function safeHomeDir() {
  try {
    return os.homedir();
  } catch {
    return process.cwd();
  }
}

function normalizeConfiguredPath(dir: unknown): string | null {
  if (typeof dir !== "string") return null;
  const trimmed = dir.trim();
  if (!trimmed) return null;
  return path.resolve(trimmed);
}

export function getLegacyDotDataDir() {
  return path.join(safeHomeDir(), `.${LEGACY_APP_NAME}`);
}

export function getDefaultDataDir() {
  const homeDir = safeHomeDir();

  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");
    const newPath = path.join(appData, APP_NAME);
    const oldPath = path.join(appData, LEGACY_APP_NAME);
    if (!fs.existsSync(newPath) && fs.existsSync(oldPath)) return oldPath;
    return newPath;
  }

  const xdgConfigHome = normalizeConfiguredPath(process.env.XDG_CONFIG_HOME);
  if (xdgConfigHome) {
    const newPath = path.join(xdgConfigHome, APP_NAME);
    const oldPath = path.join(xdgConfigHome, LEGACY_APP_NAME);
    if (!fs.existsSync(newPath) && fs.existsSync(oldPath)) return oldPath;
    return newPath;
  }

  const newDot = path.join(homeDir, `.${APP_NAME}`);
  const oldDot = path.join(homeDir, `.${LEGACY_APP_NAME}`);
  if (!fs.existsSync(newDot) && fs.existsSync(oldDot)) return oldDot;
  return newDot;
}

export function resolveDataDir({ isCloud = false }: { isCloud?: boolean } = {}): string {
  if (isCloud) return "/tmp";

  const configured = normalizeConfiguredPath(process.env.DATA_DIR);
  if (configured) return configured;

  return getDefaultDataDir();
}

export function isSamePath(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const normalizedA = path.resolve(a);
  const normalizedB = path.resolve(b);

  if (process.platform === "win32") {
    return normalizedA.toLowerCase() === normalizedB.toLowerCase();
  }

  return normalizedA === normalizedB;
}
