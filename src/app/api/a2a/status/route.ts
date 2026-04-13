import { NextResponse } from "next/server";
import { getTaskManager } from "@/lib/a2a/taskManager";

export async function GET() {
  try {
    const tm = getTaskManager();
    const stats = tm.getStats();

    let agentCard: unknown = null;
    try {
      const agentModule = await import("@/app/.well-known/agent.json/route");
      const cardResponse = await agentModule.GET();
      agentCard = await cardResponse.json();
    } catch {
      agentCard = null;
    }

    const cardData = agentCard as Record<string, unknown> | null;
    return NextResponse.json({
      status: "ok",
      tasks: stats,
      agent: cardData
        ? {
            name: cardData.name,
            description: cardData.description,
            version: cardData.version,
            url: cardData.url,
          }
        : null,
      capabilities: cardData?.capabilities || null,
      skills: Array.isArray(cardData?.skills) ? cardData.skills : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load A2A status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
