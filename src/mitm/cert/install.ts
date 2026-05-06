import fs from "fs";
import { exec } from "child_process";
import path from "path";
import os from "os";
import { execWithPassword } from "../dns/dnsConfig";
import { runElevatedPowerShell } from "../winElevated";

const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";
const IS_LINUX = process.platform === "linux";
const ROOT_CA_CN = "Routiform MITM Root CA";

function getRootCACertPath(): string {
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR.trim())
    : path.join(os.homedir(), ".routiform");
  return path.join(dataDir, "mitm", "rootCA.crt");
}

export async function checkCertInstalled(certPath: string): Promise<boolean> {
  if (IS_WIN) return checkCertInstalledWindows(certPath);
  if (IS_MAC) return checkCertInstalledMac(certPath);
  if (IS_LINUX) return checkCertInstalledLinux();
  return false;
}

function checkCertInstalledMac(_certPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`security find-certificate -c "${ROOT_CA_CN}"`, (error, stdout) => {
      if (error) return resolve(false);
      resolve(stdout.includes(ROOT_CA_CN));
    });
  });
}

function checkCertInstalledWindows(_certPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`certutil -store Root "${ROOT_CA_CN}"`, { timeout: 5000 }, (error, stdout) => {
      if (error) return resolve(false);
      resolve(stdout.includes(ROOT_CA_CN));
    });
  });
}

function checkCertInstalledLinux(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const certName = "routiform-mitm-root-ca.crt";
      const debPath = `/usr/local/share/ca-certificates/${certName}`;
      const rpmPath = `/etc/pki/ca-trust/source/anchors/${certName}`;
      resolve(fs.existsSync(debPath) || fs.existsSync(rpmPath));
    } catch {
      resolve(false);
    }
  });
}

export async function installCert(certPath: string, sudoPassword?: string): Promise<void> {
  if (IS_WIN) return installCertWindows(certPath);
  if (IS_MAC) return installCertMac(sudoPassword);
  if (IS_LINUX) return installCertLinux(certPath, sudoPassword);
  throw new Error("Unsupported platform");
}

async function installCertMac(sudoPassword?: string): Promise<void> {
  const certPath = getRootCACertPath();
  const cmd = `sudo -S security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${certPath}"`;
  if (sudoPassword) {
    await execWithPassword(cmd, sudoPassword);
  } else {
    await new Promise<void>((resolve, reject) => {
      exec(cmd, (error) => {
        if (error) reject(new Error(`Failed to install cert: ${error.message}`));
        else resolve();
      });
    });
  }
}

function installCertWindows(certPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(certPath)) return reject(new Error("Certificate file not found"));
    const psCode = `
      $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2("${certPath.replace(/\\/g, "\\\\")}");
      $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine");
      $store.Open("ReadWrite");
      $store.Add($cert);
      $store.Close();
      Write-Output "Certificate installed"
    `;
    runElevatedPowerShell(psCode)
      .then(() => resolve())
      .catch((error) => reject(new Error(`Failed to install cert: ${error.message}`)));
  });
}

function installCertLinux(certPath: string, sudoPassword?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const certName = "routiform-mitm-root-ca.crt";
    const debPath = `/usr/local/share/ca-certificates/${certName}`;
    const rpmPath = `/etc/pki/ca-trust/source/anchors/${certName}`;

    // Detect distro by checking which directory structure exists
    let targetPath = debPath;
    let updateCmd = "update-ca-certificates";
    try {
      if (fs.existsSync("/etc/pki/ca-trust/source/anchors")) {
        targetPath = rpmPath;
        updateCmd = "update-ca-trust";
      }
    } catch {
      // Fall back to deb path
    }

    const copyCmd = `cp "${certPath}" "${targetPath}" && ${updateCmd}`;
    const fullCmd = sudoPassword
      ? `echo '${sudoPassword}' | sudo -S bash -c '${copyCmd}'`
      : `sudo bash -c '${copyCmd}'`;

    exec(fullCmd, { timeout: 30000 }, (error) => {
      if (error) {
        // Try without sudo as fallback (e.g., Docker root containers)
        exec(copyCmd, { timeout: 15000 }, (err2) => {
          if (err2) reject(new Error(`Failed to install cert: ${error.message}`));
          else resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

export async function uninstallCert(certPath: string, sudoPassword?: string): Promise<void> {
  if (IS_WIN) return uninstallCertWindows();
  if (IS_MAC) return uninstallCertMac(sudoPassword);
  if (IS_LINUX) return uninstallCertLinux();
}

async function uninstallCertMac(sudoPassword?: string): Promise<void> {
  const cmd = `sudo security delete-certificate -c "${ROOT_CA_CN}" /Library/Keychains/System.keychain 2>/dev/null; sudo security delete-certificate -c "${ROOT_CA_CN}" ~/Library/Keychains/login.keychain-db 2>/dev/null`;
  if (sudoPassword) {
    await execWithPassword(cmd, sudoPassword);
  } else {
    await new Promise<void>((resolve) => exec(cmd, () => resolve()));
  }
}

function uninstallCertWindows(): Promise<void> {
  return new Promise((resolve) => {
    const psCode = `Get-ChildItem Cert:\\LocalMachine\\Root | Where-Object { $_.Subject -like "*${ROOT_CA_CN}*" } | Remove-Item -Force`;
    runElevatedPowerShell(psCode)
      .then(() => resolve())
      .catch(() => resolve());
  });
}

function uninstallCertLinux(): Promise<void> {
  return new Promise((resolve) => {
    const certName = "routiform-mitm-root-ca.crt";
    const cmd = `sudo rm -f /usr/local/share/ca-certificates/${certName} /etc/pki/ca-trust/source/anchors/${certName}; sudo update-ca-certificates 2>/dev/null; sudo update-ca-trust 2>/dev/null; echo ok`;
    exec(cmd, { timeout: 15000 }, () => resolve());
  });
}
