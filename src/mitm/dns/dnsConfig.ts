import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { runElevatedPowerShell, quotePs } from "../winElevated";
import { TOOL_HOSTS } from "@/shared/constants/mitmToolHosts";

const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";
const HOSTS_FILE = IS_WIN
  ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "drivers", "etc", "hosts")
  : "/etc/hosts";

const MARKER = "# routiform-mitm";

// A single string that quotes a value for use inside single-quoted shell strings
function _shellQuoteSingle(s: string) {
  return String(s).replace(/'/g, "'\\''");
}

export function execWithPassword(command: string, password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${error.message}\n${stderr}`));
      } else {
        resolve(stdout);
      }
    });
    child.stdin!.write(`${password}\n`);
    child.stdin!.end();
  });
}

export function checkDNSEntry(tool?: string): boolean {
  try {
    const hostsContent = fs.readFileSync(HOSTS_FILE, "utf8");
    const hosts = tool ? TOOL_HOSTS[tool] || [] : Object.values(TOOL_HOSTS).flat();
    return hosts.some((host) => hostsContent.includes(host));
  } catch {
    return false;
  }
}

export function checkAllDNSStatus(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  try {
    const hostsContent = fs.readFileSync(HOSTS_FILE, "utf8");
    for (const tool of Object.keys(TOOL_HOSTS)) {
      const hosts = TOOL_HOSTS[tool];
      result[tool] = hosts.some((host) => hostsContent.includes(host));
    }
  } catch {
    for (const tool of Object.keys(TOOL_HOSTS)) {
      result[tool] = false;
    }
  }
  return result;
}

async function flushDNS(): Promise<void> {
  if (IS_WIN) {
    try {
      await runElevatedPowerShell("ipconfig /flushdns | Out-Null");
    } catch {
      /* best effort */
    }
  } else if (IS_MAC) {
    try {
      await execPromise("sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder");
    } catch {
      /* best effort */
    }
  } else {
    try {
      await execPromise(
        "resolvectl flush-caches 2>/dev/null || systemd-resolve --flush-caches 2>/dev/null || true"
      );
    } catch {
      /* best effort */
    }
  }
}

function execPromise(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

async function atomicWriteHostsWin(content: string): Promise<void> {
  const bakPath = HOSTS_FILE + ".bak";
  const tmpPath = HOSTS_FILE + ".tmp";
  try {
    fs.writeFileSync(tmpPath, content, "utf-8");
    if (fs.existsSync(HOSTS_FILE)) fs.copyFileSync(HOSTS_FILE, bakPath);
    fs.renameSync(tmpPath, HOSTS_FILE);
    try {
      fs.unlinkSync(bakPath);
    } catch {
      /* ignore */
    }
  } catch (error) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
    throw error;
  }
}

export async function addDNSEntry(tool: string, sudoPassword?: string): Promise<void> {
  const hosts = TOOL_HOSTS[tool];
  if (!hosts || hosts.length === 0) throw new Error(`Unknown tool: ${tool}`);

  const missingHosts = hosts.filter((host) => {
    try {
      const hostsContent = fs.readFileSync(HOSTS_FILE, "utf8");
      return !hostsContent.includes(host);
    } catch {
      return true;
    }
  });

  if (missingHosts.length === 0) {
    console.log(`DNS entries for ${tool} already exist`);
    return;
  }

  try {
    for (const host of missingHosts) {
      const entry = `127.0.0.1 ${host} ${MARKER}`;
      if (IS_WIN) {
        try {
          const existing = fs.readFileSync(HOSTS_FILE, "utf8");
          const lines = existing.split(/\r?\n/).filter((l) => l.trim());
          lines.push(entry);
          lines.push("");
          await atomicWriteHostsWin(lines.join("\r\n"));
        } catch {
          const script = `Add-Content -LiteralPath ${quotePs(HOSTS_FILE)} -Value ${quotePs(entry)}`;
          await runElevatedPowerShell(script);
        }
      } else {
        if (sudoPassword) {
          const cmd = `echo '${_shellQuoteSingle(entry)}' | sudo -S tee -a ${HOSTS_FILE} > /dev/null`;
          await execWithPassword(cmd, sudoPassword);
        } else {
          const cmd = `sudo sh -c 'echo "${_shellQuoteSingle(entry)}" >> ${HOSTS_FILE}'`;
          await execPromise(cmd);
        }
      }
      console.log(`Added DNS entry: ${entry}`);
    }
    await flushDNS();
  } catch (error: unknown) {
    throw new Error(`Failed to add DNS entry for ${tool}: ${(error as Error).message}`);
  }
}

export async function removeDNSEntry(tool: string, sudoPassword?: string): Promise<void> {
  const hosts = TOOL_HOSTS[tool];
  if (!hosts || hosts.length === 0) throw new Error(`Unknown tool: ${tool}`);

  if (!checkDNSEntry(tool)) {
    console.log(`DNS entries for ${tool} do not exist`);
    return;
  }

  try {
    for (const host of hosts) {
      if (IS_WIN) {
        const script = `
          $lines = Get-Content -LiteralPath ${quotePs(HOSTS_FILE)}
          $filtered = $lines | Where-Object { $_ -notmatch [regex]::Escape(${quotePs(host)}) }
          Set-Content -LiteralPath ${quotePs(HOSTS_FILE)} -Value $filtered
        `;
        try {
          await runElevatedPowerShell(script);
        } catch {
          await atomicWriteHostsWin(
            fs
              .readFileSync(HOSTS_FILE, "utf8")
              .split(/\r?\n/)
              .filter((l) => !l.includes(host))
              .join("\r\n")
          );
        }
      } else {
        const sedCmd = IS_MAC
          ? `sudo -S sed -i '' '/${host}/d' ${HOSTS_FILE}`
          : `sudo -S sed -i '/${host}/d' ${HOSTS_FILE}`;
        if (sudoPassword) {
          try {
            await execWithPassword(sedCmd, sudoPassword);
          } catch {
            const cmd = `sudo sed -i '' '/${host}/d' ${HOSTS_FILE}`;
            await execPromise(cmd);
          }
        } else {
          const cmd = IS_MAC
            ? `sudo sed -i '' '/${host}/d' ${HOSTS_FILE}`
            : `sudo sed -i '/${host}/d' ${HOSTS_FILE}`;
          await execPromise(cmd);
        }
      }
      console.log(`Removed DNS entry for ${host}`);
    }
    await flushDNS();
  } catch (error: unknown) {
    throw new Error(`Failed to remove DNS entry for ${tool}: ${(error as Error).message}`);
  }
}

export async function removeAllDNSEntries(sudoPassword?: string): Promise<void> {
  for (const tool of Object.keys(TOOL_HOSTS)) {
    try {
      await removeDNSEntry(tool, sudoPassword);
    } catch (e) {
      console.error(`Failed to remove DNS for ${tool}: ${(e as Error).message}`);
    }
  }
}
