import { NextResponse } from "next/server";
import { getProviderConnections } from "@/lib/localDb";

function resolveClientDisplayName(connection: Record<string, unknown>): string | null {
  if (connection.displayName) return connection.displayName as string;
  const psd = connection.providerSpecificData as Record<string, unknown> | undefined;
  if (!psd) return null;
  switch (connection.provider) {
    case "github":
      return (psd.githubName as string) || (psd.githubLogin as string) || null;
    default:
      return null;
  }
}

// GET /api/providers/client - List all connections for client (includes sensitive fields for sync)
export async function GET() {
  try {
    const connections = await getProviderConnections();

    // Include sensitive fields for sync to cloud (only accessible from same origin)
    const clientConnections = connections.map((c) => {
      const displayName = resolveClientDisplayName(c);
      return {
        ...c,
        ...(displayName ? { displayName } : {}),
      };
    });

    return NextResponse.json({ connections: clientConnections });
  } catch (error) {
    console.log("Error fetching providers for client:", error);
    return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
  }
}
