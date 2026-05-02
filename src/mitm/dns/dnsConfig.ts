import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { runElevatedPowerShell, quotePs } from "../winElevated";

const TARGET_HOST = "daily-cloudcode-pa.googleapis.com";
const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";
const HOSTS_FILE = IS_WIN
  ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "drivers", "etc", "hosts")
  : "/etc/hosts";

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

export function checkDNSEntry(): boolean {
  try {
    const hostsContent = fs.readFileSync(HOSTS_FILE, "utf8");
    const lines = hostsContent.split(/\r?\n/);
    return lines.some((line) => {
      const parts = line.trim().split(/\s+/);
      return parts.length >= 2 && parts[0] === "127.0.0.1" && parts.some((p) => p === TARGET_HOST);
    });
  } catch {
    return false;
  }
}

export async function addDNSEntry(sudoPassword: string): Promise<void> {
  if (checkDNSEntry()) {
    console.log(`DNS entry for ${TARGET_HOST} already exists`);
    return;
  }

  const entry = `127.0.0.1 ${TARGET_HOST}`;

  try {
    if (IS_WIN) {
      const script = `
        Add-Content -LiteralPath ${quotePs(HOSTS_FILE)} -Value ${quotePs(entry)}
        ipconfig /flushdns | Out-Null
      `;
      await runElevatedPowerShell(script);
    } else {
      const command = `echo "${entry}" | sudo -S tee -a ${HOSTS_FILE} > /dev/null`;
      await execWithPassword(command, sudoPassword);
    }
    console.log(`✅ Added DNS entry: ${entry}`);
  } catch (error: unknown) {
    throw new Error(`Failed to add DNS entry: ${(error as Error).message}`);
  }
}

export async function removeDNSEntry(sudoPassword: string): Promise<void> {
  if (!checkDNSEntry()) {
    console.log(`DNS entry for ${TARGET_HOST} does not exist`);
    return;
  }

  try {
    if (IS_WIN) {
      const script = `
        $hosts = @(${quotePs(TARGET_HOST)})
        $lines = Get-Content -LiteralPath ${quotePs(HOSTS_FILE)}
        $filtered = $lines | Where-Object {
          $line = $_
          -not ($hosts | Where-Object { $line -match [regex]::Escape($_) })
        }
        Set-Content -LiteralPath ${quotePs(HOSTS_FILE)} -Value $filtered
        ipconfig /flushdns | Out-Null
      `;
      await runElevatedPowerShell(script);
    } else {
      const sedCmd = IS_MAC
        ? `sudo -S sed -i '' '/${TARGET_HOST}/d' ${HOSTS_FILE}`
        : `sudo -S sed -i '/${TARGET_HOST}/d' ${HOSTS_FILE}`;
      await execWithPassword(sedCmd, sudoPassword);
    }
    console.log(`✅ Removed DNS entry for ${TARGET_HOST}`);
  } catch (error: unknown) {
    throw new Error(`Failed to remove DNS entry: ${(error as Error).message}`);
  }
}
