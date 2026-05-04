import path from "path";
import fs from "fs";
import { resolveDataDir } from "@/lib/dataPaths";

const TARGET_HOSTS = ["daily-cloudcode-pa.googleapis.com", "cloudcode-pa.googleapis.com"];

/**
 * Generate self-signed SSL certificate using selfsigned (pure JS, no openssl needed)
 */
export async function generateCert() {
  const certDir = path.join(resolveDataDir(), "mitm");
  const keyPath = path.join(certDir, "server.key");
  const certPath = path.join(certDir, "server.crt");

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log("✅ SSL certificate already exists");
    return { key: keyPath, cert: certPath };
  }

  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  // Dynamic import for optional dependency
  const { default: selfsigned } = await import("selfsigned");
  const attrs = [{ name: "commonName", value: TARGET_HOSTS[0] }];
  const notAfter = new Date();
  notAfter.setFullYear(notAfter.getFullYear() + 1);
  const pems = await selfsigned.generate(attrs, {
    keySize: 2048,
    algorithm: "sha256",
    notAfterDate: notAfter,
    extensions: [
      {
        name: "subjectAltName",
        altNames: TARGET_HOSTS.map((h) => ({ type: 2, value: h })),
      },
    ],
  });

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);

  console.log(`✅ Generated SSL certificate for ${TARGET_HOSTS.join(", ")}`);
  return { key: keyPath, cert: certPath };
}
