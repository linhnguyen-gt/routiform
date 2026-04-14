import { NextResponse } from "next/server";
import { isAuthenticated } from "@/shared/utils/apiAuth";
import fs from "fs/promises";
import type { Stats } from "fs";
import path from "path";
import os from "os";
import { CLI_TOOL_IDS } from "@/shared/services/cliRuntime";

// Map CLI tool display names
const CLI_DISPLAY_NAMES: Record<string, string> = {
  claude: "Claude Code CLI",
  codex: "OpenAI Codex CLI",
  opencode: "OpenCode",
  openclaw: "OpenClaw",
  cline: "Cline",
  cursor: "Cursor",
  continue: "Continue",
  windsurf: "Windsurf",
  droid: "Droid CLI",
  kilo: "Kilo CLI",
  qoder: "Qoder",
  aider: "Aider",
};

// Generate skills paths for each CLI tool
function getSkillsPathsForTool(toolId: string): string[] {
  const homeDir = os.homedir();
  const projectDir = process.cwd();

  // Common patterns for skills directories
  const patterns = [
    path.join(homeDir, `.${toolId}`, "skills"),
    path.join(projectDir, `.${toolId}`, "skills"),
    path.join(homeDir, ".config", toolId, "skills"),
    path.join(homeDir, `.${toolId}`), // For config files
    path.join(projectDir, `.${toolId}`), // For project-level config
  ];

  // Special cases
  if (toolId === "cursor") {
    patterns.push(path.join(projectDir, ".cursorrules"));
  }
  if (toolId === "aider") {
    patterns.push(path.join(projectDir, ".aider.conf.yml"));
  }
  if (toolId === "kilo") {
    patterns.push(path.join(homeDir, ".local", "share", "kilo", "skills"));
  }
  if (toolId === "droid") {
    patterns.push(path.join(homeDir, ".factory", "skills"));
    patterns.push(path.join(projectDir, ".factory", "skills"));
  }
  if (toolId === "cline") {
    patterns.push(path.join(projectDir, ".vscode", "cline"));
  }
  if (toolId === "opencode") {
    patterns.push(path.join(homeDir, ".config", "opencode", "skill")); // singular "skill"
  }

  return patterns;
}

async function scanProviderSkills(providerId: string) {
  const skills: Array<{
    skillId: string;
    name: string;
    path: string;
    installedAt: string;
    size: number;
    provider: string;
    providerName: string;
  }> = [];

  const displayName = CLI_DISPLAY_NAMES[providerId] || providerId;
  const paths = getSkillsPathsForTool(providerId);
  const seenSkillIds = new Set<string>();

  for (const dirPath of paths) {
    try {
      const stats = await fs.stat(dirPath);

      // Handle single file (like .cursorrules)
      if (stats.isFile()) {
        const fileName = path.basename(dirPath);
        if (seenSkillIds.has(fileName)) continue;
        seenSkillIds.add(fileName);

        skills.push({
          skillId: fileName,
          name: fileName,
          path: dirPath,
          installedAt: stats.mtime.toISOString(),
          size: stats.size,
          provider: providerId,
          providerName: displayName,
        });
        continue;
      }

      // Handle directory with multiple skills
      if (stats.isDirectory()) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const skillDirs = entries.filter((e) => e.isDirectory());

        for (const dir of skillDirs) {
          if (seenSkillIds.has(dir.name)) continue;

          // Try direct SKILL.md first
          let skillPath = path.join(dirPath, dir.name, "SKILL.md");
          let skillStats: Stats | null = null;

          try {
            skillStats = await fs.stat(skillPath);
          } catch {
            // If not found, try nested directories (e.g., .system/skill-name/SKILL.md)
            try {
              const nestedEntries = await fs.readdir(path.join(dirPath, dir.name), {
                withFileTypes: true,
              });
              const nestedDirs = nestedEntries.filter((e) => e.isDirectory());

              for (const nestedDir of nestedDirs) {
                const nestedSkillPath = path.join(dirPath, dir.name, nestedDir.name, "SKILL.md");
                try {
                  skillStats = await fs.stat(nestedSkillPath);
                  skillPath = nestedSkillPath;

                  if (seenSkillIds.has(nestedDir.name)) continue;

                  const content = await fs.readFile(nestedSkillPath, "utf-8");
                  const firstLine = content.split("\n")[0];
                  const name = firstLine.startsWith("#")
                    ? firstLine.replace(/^#+\s*/, "").trim()
                    : nestedDir.name;

                  seenSkillIds.add(nestedDir.name);
                  skills.push({
                    skillId: nestedDir.name,
                    name,
                    path: nestedSkillPath,
                    installedAt: skillStats.mtime.toISOString(),
                    size: skillStats.size,
                    provider: providerId,
                    providerName: displayName,
                  });
                } catch {
                  // Skip if nested SKILL.md doesn't exist
                }
              }
              continue;
            } catch {
              // Skip if can't read nested directory
              continue;
            }
          }

          if (skillStats) {
            try {
              const content = await fs.readFile(skillPath, "utf-8");
              const firstLine = content.split("\n")[0];
              const name = firstLine.startsWith("#")
                ? firstLine.replace(/^#+\s*/, "").trim()
                : dir.name;

              seenSkillIds.add(dir.name);
              skills.push({
                skillId: dir.name,
                name,
                path: skillPath,
                installedAt: skillStats.mtime.toISOString(),
                size: skillStats.size,
                provider: providerId,
                providerName: displayName,
              });
            } catch {
              // Skip if can't read SKILL.md
            }
          }
        }
      }
    } catch {
      // Skip if path doesn't exist
    }
  }

  return skills;
}

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Scan all CLI tools from cliRuntime
    const allSkills = await Promise.all(CLI_TOOL_IDS.map((toolId) => scanProviderSkills(toolId)));

    // Flatten and group by provider
    const flatSkills = allSkills.flat();
    const groupedByProvider: Record<string, Array<(typeof flatSkills)[number]>> = {};

    for (const skill of flatSkills) {
      if (!groupedByProvider[skill.provider]) {
        groupedByProvider[skill.provider] = [];
      }
      groupedByProvider[skill.provider].push(skill);
    }

    return NextResponse.json({
      skills: flatSkills,
      byProvider: groupedByProvider,
      providers: CLI_TOOL_IDS.map((toolId) => ({
        id: toolId,
        name: CLI_DISPLAY_NAMES[toolId] || toolId,
        count: groupedByProvider[toolId]?.length || 0,
      })),
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const skillId = searchParams.get("skillId");
    const provider = searchParams.get("provider");

    if (!skillId || !provider) {
      return NextResponse.json({ error: "skillId and provider required" }, { status: 400 });
    }

    // Try to delete from all possible paths
    const paths = getSkillsPathsForTool(provider);
    for (const dirPath of paths) {
      try {
        const skillPath = path.join(dirPath, skillId);
        await fs.rm(skillPath, { recursive: true, force: true });
        return NextResponse.json({ success: true });
      } catch {
        // Try next path
      }
    }

    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
