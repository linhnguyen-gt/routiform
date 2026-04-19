import { NextResponse } from "next/server";
import { verifyMemoryFts } from "@/lib/memory/verify";

export async function GET() {
  try {
    const status = verifyMemoryFts();
    return NextResponse.json(status, { status: status.healthy ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ healthy: false, error: message }, { status: 500 });
  }
}
