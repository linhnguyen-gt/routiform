/**
 * Cert generation facade — wraps rootCA.ts for TypeScript consumers.
 * The actual PKI logic lives in rootCA.ts so both manager.ts (TS) and
 * server.ts (standalone tsx) can share the same cert generation.
 */
import path from "path";
import { resolveDataDir } from "@/lib/dataPaths";

const MITM_DIR = path.join(resolveDataDir(), "mitm");

export { MITM_DIR };

export async function generateCert() {
  const { generateRootCA } = await import("./rootCA");
  return generateRootCA();
}

export async function getCertForDomain(domain: string) {
  const { loadRootCA, generateLeafCert } = await import("./rootCA");
  const ca = loadRootCA();
  return generateLeafCert(domain, ca);
}
