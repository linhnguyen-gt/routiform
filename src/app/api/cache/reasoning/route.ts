import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/shared/utils/apiAuth";
import {
  clearReasoningCacheAll,
  deleteReasoningCacheEntry,
  getReasoningCacheServiceEntries,
  getReasoningCacheServiceStats,
} from "@routiform/open-sse/services/reasoningCache.ts";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") || undefined;
    const model = searchParams.get("model") || undefined;
    const rawLimit = parseInt(searchParams.get("limit") || "50", 10);
    const rawOffset = parseInt(searchParams.get("offset") || "0", 10);
    const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 50 : rawLimit, 1), 200);
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

    return NextResponse.json({
      stats: getReasoningCacheServiceStats(),
      entries: getReasoningCacheServiceEntries({ provider, model, limit, offset }),
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const toolCallId = searchParams.get("toolCallId") || undefined;
    const provider = searchParams.get("provider") || undefined;
    const model = searchParams.get("model") || undefined;

    if (toolCallId) {
      const cleared = deleteReasoningCacheEntry(toolCallId, provider, model);
      return NextResponse.json({
        ok: true,
        scope: "toolCallId",
        toolCallId,
        cleared,
      });
    }

    const cleared = clearReasoningCacheAll(provider);
    return NextResponse.json({
      ok: true,
      scope: provider ? "provider" : "all",
      ...(provider ? { provider } : {}),
      cleared,
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
