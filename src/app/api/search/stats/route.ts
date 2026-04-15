import { NextResponse } from "next/server";
import { getCacheStats } from "@routiform/open-sse/services/searchCache.ts";
import { SEARCH_PROVIDERS } from "@routiform/open-sse/config/searchRegistry.ts";
import { getDbInstance } from "@/lib/db/core";
import { isAuthenticated } from "@/shared/utils/apiAuth";

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = getDbInstance();
    const cache = getCacheStats();

    // Provider aggregate stats — cost is per-query from registry
    const providerStats = db
      .prepare(
        `
        SELECT provider, COUNT(*) as requests,
          CAST(AVG(duration) AS INTEGER) as avg_latency_ms
        FROM call_logs
        WHERE request_type = 'search'
        GROUP BY provider
      `
      )
      .all();

    const providers: Record<
      string,
      { requests: number; avg_latency_ms: number; total_cost: number }
    > = {};
    for (const row of providerStats as Array<Record<string, unknown>>) {
      const costPerQuery = SEARCH_PROVIDERS[row.provider as string]?.costPerQuery || 0;
      providers[row.provider as string] = {
        requests: row.requests as number,
        avg_latency_ms: row.avg_latency_ms as number,
        total_cost: parseFloat(((row.requests as number) * costPerQuery).toFixed(4)),
      };
    }

    // Recent searches
    const recentRows = db
      .prepare(
        `
        SELECT request_body, provider, timestamp
        FROM call_logs
        WHERE request_type = 'search'
        ORDER BY timestamp DESC
        LIMIT 10
      `
      )
      .all();

    const recent_searches = (recentRows as Array<Record<string, unknown>>).map((row) => {
      let query = "";
      let filters = {};
      try {
        const body = JSON.parse(row.request_body as string);
        query = body.query || "";
        const { query: _q, provider: _p, ...rest } = body;
        filters = rest;
      } catch {
        // Unparseable request_body
      }
      return {
        query,
        provider: row.provider,
        timestamp: row.timestamp,
        filters,
      };
    });

    return NextResponse.json({ cache, providers, recent_searches });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
  }
}
