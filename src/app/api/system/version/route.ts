/**
 * GET  /api/system/version  — Returns current version and latest available on npm
 * POST /api/system/update   — Triggers npm install -g omniroute@latest + pm2 restart
 *
 * Security: Requires admin authentication (same as other management routes).
 * Safety: Update only runs if a newer version is available on npm.
 */
import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { isAuthenticated } from "@/shared/utils/apiAuth";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

/** Fetch latest version from npm registry (no install, just metadata) */
async function getLatestNpmVersion(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("npm", ["info", "omniroute", "version", "--json"], {
      timeout: 10000,
    });
    const parsed = JSON.parse(stdout.trim());
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/** Current installed version from package.json */
function getCurrentVersion(): string {
  try {
    return require("../../../../../package.json").version as string;
  } catch {
    return "unknown";
  }
}

/** Compare semver strings — returns true if a > b */
function isNewer(a: string | null, b: string): boolean {
  if (!a) return false;
  const parse = (v: string) => v.split(".").map(Number);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat > bPat;
}

export async function GET(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const current = getCurrentVersion();
  const latest = await getLatestNpmVersion();
  const updateAvailable = isNewer(latest, current);

  return NextResponse.json({
    current,
    latest: latest ?? "unavailable",
    updateAvailable,
    channel: "npm",
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const current = getCurrentVersion();
  const latest = await getLatestNpmVersion();

  if (!latest) {
    return NextResponse.json(
      { success: false, error: "Could not reach npm registry" },
      { status: 503 }
    );
  }

  if (!isNewer(latest, current)) {
    return NextResponse.json({
      success: false,
      error: `Already on latest version (${current})`,
      current,
      latest,
    });
  }

  // Stream progress events so the frontend can show real-time status
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Step 1: Install
        send({ step: "install", status: "running", message: `Installing omniroute@${latest}...` });
        await execFileAsync("npm", ["install", "-g", `omniroute@${latest}`, "--ignore-scripts"], {
          timeout: 300000,
        });
        send({ step: "install", status: "done", message: `Installed omniroute@${latest}` });

        // Step 2: Rebuild native modules (critical for better-sqlite3)
        send({
          step: "rebuild",
          status: "running",
          message: "Rebuilding native modules (better-sqlite3)...",
        });
        const globalRoot = (
          await execFileAsync("npm", ["root", "-g"], { timeout: 10000 })
        ).stdout.trim();
        const omniPath = `${globalRoot}/omniroute/app`;
        await execFileAsync("npm", ["rebuild", "better-sqlite3"], {
          cwd: omniPath,
          timeout: 120000,
        });
        send({ step: "rebuild", status: "done", message: "Native modules rebuilt" });

        // Step 3: Restart PM2
        send({ step: "restart", status: "running", message: "Restarting service via PM2..." });
        try {
          await execFileAsync("pm2", ["restart", "omniroute", "--update-env"], { timeout: 30000 });
          send({ step: "restart", status: "done", message: "Service restarted" });
        } catch {
          // PM2 may not be available (Docker/manual setups)
          send({
            step: "restart",
            status: "skipped",
            message: "PM2 not available — manual restart needed",
          });
        }

        send({
          step: "complete",
          status: "done",
          from: current,
          to: latest,
          message: `Update to v${latest} complete!`,
        });
        console.log(`[AutoUpdate] Successfully updated to v${latest}`);
      } catch (err: any) {
        const errMsg = err?.stderr || err?.message || String(err);
        send({ step: "error", status: "failed", message: errMsg });
        console.error(`[AutoUpdate] Update failed:`, err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
