import { spawn, execSync } from "child_process";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import os from "os";
import { resolveDataDir } from "@/lib/dataPaths";
import {
  addDNSEntry,
  removeDNSEntry,
  removeAllDNSEntries,
  checkAllDNSStatus,
} from "./dns/dnsConfig";
import { generateCert } from "./cert/generate";
import { installCert } from "./cert/install";
import { isAdmin, runElevatedPowerShell } from "./winElevated";

const IS_WIN = process.platform === "win32";

function isDocker(): boolean {
  try {
    return fs.existsSync("/.dockerenv");
  } catch {
    return false;
  }
}

function isHostOpsSkipped(): boolean {
  return isDocker() || !!process.env.MITM_SKIP_HOST_OPS;
}

export { isDocker };

let serverProcess: ReturnType<typeof spawn> | null = null;
let serverPid: number | null = null;

// Auto-restart state
let mitmRestartCount = 0;
let mitmRestartTimer: ReturnType<typeof setTimeout> | null = null;
let mitmRestartEnabled = false;
const MITM_MAX_RESTARTS = 5;
const MITM_RESTART_DELAYS_MS = [5000, 10000, 20000, 30000, 60000];
const MITM_RESTART_RESET_MS = 60000;

let mitmIsStopping = false;

// Module-scoped password cache
let _cachedPassword: string | null = null;
// Saved NODE_EXTRA_CA_CERTS for cleanup on stop
let _savedNODE_EXTRA_CA_CERTS: string | null = null;
export function getCachedPassword() {
  return _cachedPassword;
}
export function setCachedPassword(pwd: string | null) {
  _cachedPassword = pwd || null;
}
export function clearCachedPassword() {
  _cachedPassword = null;
}

// ── Encrypted password persistence ───────────────────────────────
const MITM_ENCRYPTED_PWD_KEY = "mitm_encrypted_password";
const ENCRYPTION_ALGO = "aes-256-gcm";

function deriveKey(): Buffer {
  const hostname = os.hostname();
  const username = os.userInfo().username;
  const material = `routiform-mitm:${hostname}:${username}`;
  return crypto.createHash("sha256").update(material).digest();
}

export async function loadEncryptedPassword(): Promise<string | null> {
  try {
    const { getSettings } = await import("@/lib/db/settings");
    const settings = await getSettings();
    const encrypted = settings[MITM_ENCRYPTED_PWD_KEY] as string | undefined;
    if (!encrypted || typeof encrypted !== "string") return null;
    const key = deriveKey();
    const parts = encrypted.split(":");
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const data = Buffer.from(parts[2], "hex");
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted: string = decipher.update(data).toString("utf8");
    decrypted += decipher.final("utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}

export async function saveEncryptedPassword(password: string): Promise<void> {
  try {
    const { updateSettings } = await import("@/lib/db/settings");
    const key = deriveKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);
    let encrypted = cipher.update(password, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();
    const stored = `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
    await updateSettings({ [MITM_ENCRYPTED_PWD_KEY]: stored });
  } catch {
    /* non-critical */
  }
}

export async function clearEncryptedPassword(): Promise<void> {
  try {
    const { updateSettings } = await import("@/lib/db/settings");
    await updateSettings({ [MITM_ENCRYPTED_PWD_KEY]: null });
  } catch {
    /* non-critical */
  }
}

// ── Paths ────────────────────────────────────────────────────────
const MITM_DIR = path.join(resolveDataDir(), "mitm");
const PID_FILE = path.join(MITM_DIR, ".mitm.pid");
const MITM_SERVER_SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname), "server.ts");

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ── Port conflict detection ──────────────────────────────────────
export function checkPort443Free(): boolean {
  return new Promise((resolve) => {
    const net = require("net");
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(443);
  }) as unknown as boolean;
}

export function getPort443Owner(): { pid: number; name: string } | null {
  try {
    const output = execSync("lsof -nP -iTCP:443 -sTCP:LISTEN -t -c ''", {
      encoding: "utf8",
      timeout: 3000,
    }).trim();
    if (!output) return null;
    const pids = output.split("\n").filter(Boolean);
    if (pids.length === 0) return null;
    const pid = parseInt(pids[0], 10);
    let name = "unknown";
    try {
      name =
        execSync(`ps -p ${pid} -o comm=`, { encoding: "utf8", timeout: 1000 }).trim() || "unknown";
    } catch {
      /* ignore */
    }
    return { pid, name };
  } catch {
    return null;
  }
}

// ── Health check ────────────────────────────────────────────────
async function pollMitmHealth(port: number, timeoutMs: number = 5000): Promise<boolean> {
  const start = Date.now();
  const https = await import("https");
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = https.request(
          {
            hostname: "127.0.0.1",
            port,
            path: "/_mitm_health",
            method: "GET",
            rejectUnauthorized: false,
            timeout: 1000,
          },
          (res) => {
            if (res.statusCode === 200) resolve();
            else reject(new Error(`Status ${res.statusCode}`));
          }
        );
        req.on("error", reject);
        req.end();
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

// ── Auto-restart ─────────────────────────────────────────────────
function scheduleMitmRestart(apiKey: string, sudoPassword: string) {
  if (!mitmRestartEnabled || mitmIsStopping) return;
  if (mitmRestartCount >= MITM_MAX_RESTARTS) {
    console.log(`MITM auto-restart exhausted (${mitmRestartCount}/${MITM_MAX_RESTARTS})`);
    return;
  }
  const delay =
    MITM_RESTART_DELAYS_MS[Math.min(mitmRestartCount, MITM_RESTART_DELAYS_MS.length - 1)];
  console.log(`MITM restart #${mitmRestartCount + 1} in ${delay}ms...`);
  mitmRestartTimer = setTimeout(() => {
    mitmRestartCount++;
    startMitm(apiKey, sudoPassword).catch((e) => {
      console.error("MITM auto-restart failed:", e.message);
    });
  }, delay);
}

function resetRestartCounter() {
  if (mitmRestartCount > 0) {
    mitmRestartCount = 0;
    console.log("MITM restart counter reset (server stable)");
  }
}

// ── Get MITM status ─────────────────────────────────────────────
export async function getMitmStatus() {
  let running = serverProcess !== null && !serverProcess.killed;
  let pid = serverPid;

  if (!running) {
    try {
      if (fs.existsSync(PID_FILE)) {
        const savedPid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
        if (savedPid && isProcessAlive(savedPid)) {
          running = true;
          pid = savedPid;
        } else {
          try {
            fs.unlinkSync(PID_FILE);
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  const certPath = path.join(MITM_DIR, "rootCA.crt");
  const certExists = fs.existsSync(certPath);

  let certTrusted = false;
  if (certExists && !isHostOpsSkipped()) {
    try {
      const { checkCertInstalled } = await import("./cert/install");
      certTrusted = await checkCertInstalled(certPath);
    } catch {
      /* ignore */
    }
  }

  const dnsStatus = isHostOpsSkipped() ? {} : checkAllDNSStatus();

  const hasCachedPassword = !!_cachedPassword;

  return {
    running,
    pid: pid || null,
    certExists,
    certTrusted,
    dnsStatus,
    hasCachedPassword,
  };
}

// ── Start MITM ──────────────────────────────────────────────────
export async function startMitm(apiKey: string, sudoPassword: string) {
  if (serverProcess && !serverProcess.killed) {
    throw new Error("MITM proxy is already running");
  }

  mitmIsStopping = false;
  mitmRestartEnabled = true;

  // 1. Generate SSL certificate
  const certPath = path.join(MITM_DIR, "rootCA.crt");
  if (!fs.existsSync(certPath)) {
    console.log("Generating Root CA certificate...");
    await generateCert();
  }

  // Register cert for Node.js fetch
  if (!isHostOpsSkipped() && fs.existsSync(certPath)) {
    _savedNODE_EXTRA_CA_CERTS = process.env.NODE_EXTRA_CA_CERTS || null;
    const existing = process.env.NODE_EXTRA_CA_CERTS || "";
    if (!existing.includes(certPath)) {
      process.env.NODE_EXTRA_CA_CERTS = existing ? `${existing}:${certPath}` : certPath;
      console.log("MITM cert added to NODE_EXTRA_CA_CERTS");
    }
  }

  // 2. Install certificate to system trust store
  if (!isHostOpsSkipped()) {
    await installCert(certPath, sudoPassword);
  } else {
    console.log("Docker: skipping host cert install");
  }

  // 3. Add DNS entries for antigravity (always) + any previously enabled tools
  if (!isHostOpsSkipped()) {
    console.log("Adding DNS entries...");
    // Always add antigravity DNS
    await addDNSEntry("antigravity", sudoPassword);
  } else {
    console.log("Docker: skipping host DNS");
  }

  // 4. Encrypt and persist password
  if (!IS_WIN && sudoPassword && sudoPassword !== _cachedPassword) {
    try {
      await saveEncryptedPassword(sudoPassword);
    } catch (e) {
      console.warn("Failed to persist sudo password:", (e as Error).message);
    }
  }

  // 5. Start MITM server
  const serverPath = MITM_SERVER_SRC;
  console.log("Starting MITM server from:", serverPath);

  // Resolve tsx CLI path
  const tsxCliPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "../../node_modules/tsx/dist/cli.mjs"
  );

  // Pass NODE_PATH so bare specifier imports can find node_modules
  const nodePath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "../../node_modules"
  );

  serverProcess = spawn(process.execPath, [tsxCliPath, serverPath], {
    env: {
      ...process.env,
      ROUTER_API_KEY: apiKey,
      DATA_DIR: resolveDataDir(),
      NODE_ENV: "production",
      NODE_PATH: nodePath,
    },
    cwd: process.cwd(),
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverPid = serverProcess.pid;
  fs.writeFileSync(PID_FILE, String(serverPid));

  serverProcess.stdout!.on("data", (data) => {
    console.log(`[MITM] ${data.toString().trim()}`);
  });

  serverProcess.stderr!.on("data", (data) => {
    console.error(`[MITM] ${data.toString().trim()}`);
  });

  serverProcess.on("exit", (code, signal) => {
    console.log(`MITM server exited (code=${code}, signal=${signal})`);
    serverProcess = null;
    serverPid = null;
    try {
      fs.unlinkSync(PID_FILE);
    } catch {
      /* ignore */
    }

    if (!mitmIsStopping && mitmRestartEnabled && code !== 0) {
      scheduleMitmRestart(apiKey, sudoPassword);
    }
  });

  // 6. Health check
  const healthy = await pollMitmHealth(443, 8000);
  if (!healthy) {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill("SIGTERM");
      serverProcess = null;
      serverPid = null;
    }
    // Restore NODE_EXTRA_CA_CERTS on failure
    if (_savedNODE_EXTRA_CA_CERTS !== null) {
      process.env.NODE_EXTRA_CA_CERTS = _savedNODE_EXTRA_CA_CERTS || "";
    }
    throw new Error("MITM server failed to start (health check timed out)");
  }

  // Reset restart counter after successful start + 1s stability
  setTimeout(resetRestartCounter, MITM_RESTART_RESET_MS);

  return { running: true, pid: serverPid };
}

// ── Stop MITM ───────────────────────────────────────────────────
export async function stopMitm(sudoPassword: string) {
  mitmIsStopping = true;
  mitmRestartEnabled = false;

  if (mitmRestartTimer) {
    clearTimeout(mitmRestartTimer);
    mitmRestartTimer = null;
  }

  // 1. Kill server process
  const proc = serverProcess;
  if (proc && !proc.killed) {
    console.log("Stopping MITM server...");
    proc.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (!proc.killed) proc.kill("SIGKILL");
    serverProcess = null;
    serverPid = null;
  } else {
    try {
      if (fs.existsSync(PID_FILE)) {
        const savedPid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
        if (savedPid && isProcessAlive(savedPid)) {
          console.log(`Killing MITM server (PID: ${savedPid})...`);
          process.kill(savedPid, "SIGTERM");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (isProcessAlive(savedPid)) process.kill(savedPid, "SIGKILL");
        }
      }
    } catch {
      /* ignore */
    }
    serverProcess = null;
    serverPid = null;
  }

  // 2. Remove all DNS entries
  if (!isHostOpsSkipped()) {
    console.log("Removing DNS entries...");
    await removeAllDNSEntries(sudoPassword);
    if (IS_WIN) {
      try {
        if (isAdmin()) {
          execSync("ipconfig /flushdns", { windowsHide: true, stdio: "ignore" });
        } else {
          await runElevatedPowerShell("ipconfig /flushdns | Out-Null");
        }
      } catch {
        /* best effort */
      }
    }
  } else {
    console.log("Docker: skipping host DNS cleanup");
  }

  // 3. Clean up
  clearCachedPassword();
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    /* ignore */
  }
  // Restore NODE_EXTRA_CA_CERTS to original value
  if (_savedNODE_EXTRA_CA_CERTS !== null) {
    if (_savedNODE_EXTRA_CA_CERTS) {
      process.env.NODE_EXTRA_CA_CERTS = _savedNODE_EXTRA_CA_CERTS;
    } else {
      delete process.env.NODE_EXTRA_CA_CERTS;
    }
    _savedNODE_EXTRA_CA_CERTS = null;
  }

  return { running: false, pid: null };
}

// ── Per-tool DNS management ─────────────────────────────────────
export async function enableToolDNS(tool: string, sudoPassword: string): Promise<void> {
  await addDNSEntry(tool, sudoPassword);
}

export async function disableToolDNS(tool: string, sudoPassword: string): Promise<void> {
  await removeDNSEntry(tool, sudoPassword);
}
