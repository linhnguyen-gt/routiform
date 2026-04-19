import { getClientIpFromRequest } from "@/lib/ipUtils";
import { logAuditEvent } from "@/lib/compliance";
import {
  buildSyncTokenAuditDetails,
  createSyncToken,
  getSyncTokenById,
  listSyncTokens,
  markSyncTokenUsed,
  parseSyncAuthorizationHeader,
  revokeSyncToken,
  validateSyncToken,
  type SyncTokenCreateResult,
  type SyncTokenRecord,
} from "@/lib/db/syncTokens";

type TokenAuthResult = {
  ok: boolean;
  status: number;
  error?: string;
  tokenRecord?: SyncTokenRecord;
};

function audit(
  action: string,
  actor: string,
  request: Request,
  target: string,
  details: Record<string, unknown>
) {
  logAuditEvent({
    action,
    actor,
    target,
    details,
    ipAddress: getClientIpFromRequest(request),
  });
}

export async function issueSyncToken(
  name: string,
  request: Request
): Promise<SyncTokenCreateResult> {
  const created = await createSyncToken(name);
  const auditDetails = await buildSyncTokenAuditDetails(created);
  audit("sync.token.create", "management", request, created.id, auditDetails);
  return created;
}

export async function listSyncTokenRecords(request: Request): Promise<SyncTokenRecord[]> {
  const rows = await listSyncTokens();
  audit("sync.token.list", "management", request, "sync_tokens", { count: rows.length });
  return rows;
}

export async function revokeSyncTokenById(id: string, request: Request): Promise<boolean> {
  const revoked = await revokeSyncToken(id);
  if (revoked) {
    audit("sync.token.revoke", "management", request, id, { revoked: true });
  }
  return revoked;
}

export async function getSyncTokenRecord(
  id: string,
  request: Request
): Promise<SyncTokenRecord | null> {
  const row = await getSyncTokenById(id);
  if (row) {
    audit("sync.token.get", "management", request, id, { isActive: row.isActive });
  }
  return row;
}

export async function authenticateSyncToken(request: Request): Promise<TokenAuthResult> {
  const { token, malformed } = await parseSyncAuthorizationHeader(request);
  if (malformed) {
    return { ok: false, status: 400, error: "Malformed Authorization header" };
  }
  if (!token) {
    return { ok: false, status: 401, error: "Missing sync token" };
  }

  const record = await validateSyncToken(token);
  if (!record) {
    audit("sync.bundle.auth_failed", "sync-client", request, "sync_bundle", {
      reason: "invalid_token",
    });
    return { ok: false, status: 401, error: "Invalid sync token" };
  }

  await markSyncTokenUsed(record.id);
  audit("sync.bundle.auth_ok", `sync-token:${record.id}`, request, record.id, {
    tokenPrefix: record.tokenPrefix,
  });

  return { ok: true, status: 200, tokenRecord: record };
}
