import { NextResponse } from "next/server";
import {
  getAuditActorFromRequest,
  getAuditIpFromRequest,
  getAuditLog,
  logAuditEvent,
} from "@/lib/compliance/index";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || undefined;
    const actor = searchParams.get("actor") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const logs = getAuditLog({
      action,
      actor,
      limit,
      offset,
      excludeActions: ["compliance.audit_log.read"],
    });

    logAuditEvent({
      action: "compliance.audit_log.read",
      actor: await getAuditActorFromRequest(request),
      target: "audit_log",
      details: {
        action: action || null,
        actor: actor || null,
        limit,
        offset,
        returned: Array.isArray(logs) ? logs.length : 0,
      },
      ipAddress: getAuditIpFromRequest(request),
    });

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
