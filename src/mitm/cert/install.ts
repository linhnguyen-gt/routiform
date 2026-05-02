import fs from "fs";
import crypto from "crypto";
import { exec } from "child_process";
import { execWithPassword } from "../dns/dnsConfig";
import { runElevatedPowerShell, quotePs } from "../winElevated";

const IS_WIN = process.platform === "win32";
const ROOT_CA_CN = "Routiform MITM Root CA";

function getCertFingerprint(certPath: string): string {
  const pem = fs.readFileSync(certPath, "utf-8");
  const der = Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""), "base64");
  return crypto
    .createHash("sha1")
    .update(der)
    .digest("hex")
    .toUpperCase()
    .match(/.{2}/g)!
    .join(":");
}

export async function checkCertInstalled(certPath: string): Promise<boolean> {
  if (IS_WIN) {
    return checkCertInstalledWindows(certPath);
  }
  return checkCertInstalledMac(certPath);
}

function checkCertInstalledMac(certPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const fingerprint = getCertFingerprint(certPath);
      exec(
        `security find-certificate -a -Z /Library/Keychains/System.keychain | grep -i "${fingerprint}"`,
        (error) => {
          resolve(!error);
        }
      );
    } catch {
      resolve(false);
    }
  });
}

function checkCertInstalledWindows(certPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    let fingerprint: string;
    try {
      fingerprint = getCertFingerprint(certPath).replace(/:/g, "");
    } catch {
      return resolve(false);
    }
    exec(`certutil -store Root ${fingerprint}`, { windowsHide: true }, (error) => {
      resolve(!error);
    });
  });
}

export async function installCert(sudoPassword: string, certPath: string): Promise<void> {
  if (!fs.existsSync(certPath)) {
    throw new Error(`Certificate file not found: ${certPath}`);
  }

  const isInstalled = await checkCertInstalled(certPath);
  if (isInstalled) {
    console.log("✅ Certificate already installed");
    return;
  }

  if (IS_WIN) {
    await installCertWindows(certPath);
  } else {
    await installCertMac(sudoPassword, certPath);
  }
}

async function installCertMac(sudoPassword: string, certPath: string): Promise<void> {
  const command = `sudo -S security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${certPath}"`;
  try {
    await execWithPassword(command, sudoPassword);
    console.log(`✅ Installed certificate to system keychain: ${certPath}`);
  } catch (error: unknown) {
    const msg = (error as Error).message?.includes("canceled")
      ? "User canceled authorization"
      : "Certificate install failed";
    throw new Error(msg);
  }
}

async function installCertWindows(certPath: string): Promise<void> {
  const script = `
    certutil -delstore Root ${quotePs(ROOT_CA_CN)} 2>$null | Out-Null
    $exit = & certutil -addstore Root ${quotePs(certPath)} 2>&1
    if ($LASTEXITCODE -ne 0) { throw "certutil exit $LASTEXITCODE" }
  `;
  try {
    await runElevatedPowerShell(script);
    console.log("🔐 Cert: ✅ installed to Windows Root store");
  } catch (e: unknown) {
    throw new Error(`Failed to install certificate: ${(e as Error).message}`);
  }
}

export async function uninstallCert(sudoPassword: string, certPath: string): Promise<void> {
  const isInstalled = await checkCertInstalled(certPath);
  if (!isInstalled) {
    console.log("Certificate not found in system store");
    return;
  }

  if (IS_WIN) {
    await uninstallCertWindows();
  } else {
    await uninstallCertMac(sudoPassword, certPath);
  }
}

async function uninstallCertMac(sudoPassword: string, certPath: string): Promise<void> {
  const fingerprint = getCertFingerprint(certPath).replace(/:/g, "");
  const command = `sudo -S security delete-certificate -Z "${fingerprint}" /Library/Keychains/System.keychain`;
  try {
    await execWithPassword(command, sudoPassword);
    console.log("✅ Uninstalled certificate from system keychain");
  } catch (_err) {
    throw new Error("Failed to uninstall certificate");
  }
}

async function uninstallCertWindows(): Promise<void> {
  const script = `certutil -delstore Root ${quotePs(ROOT_CA_CN)}`;
  try {
    await runElevatedPowerShell(script);
    console.log("🔐 Cert: ✅ uninstalled from Windows Root store");
  } catch (e: unknown) {
    throw new Error(`Failed to uninstall certificate: ${(e as Error).message}`);
  }
}
