import { NextResponse } from "next/server";
import { isAuthenticated } from "@/shared/utils/apiAuth";
import { fetchSkillMd } from "@/lib/skills/skillssh";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

const InstallRequestSchema = z.object({
  skillId: z.string().min(1),
  name: z.string().min(1),
  source: z.string().min(1), // GitHub "owner/repo"
});

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { skillId, name, source } = InstallRequestSchema.parse(body);

    // Fetch SKILL.md content from GitHub
    const skillContent = await fetchSkillMd(source, skillId);

    // Determine skills directory (check both possible locations)
    const skillsDir = path.join(process.cwd(), ".claude", "skills");
    const altSkillsDir = path.join(process.cwd(), "skills");

    let targetDir = skillsDir;
    try {
      await fs.access(skillsDir);
    } catch {
      // If .claude/skills doesn't exist, try skills/
      try {
        await fs.access(altSkillsDir);
        targetDir = altSkillsDir;
      } catch {
        // Create .claude/skills if neither exists
        await fs.mkdir(skillsDir, { recursive: true });
      }
    }

    // Create skill directory
    const skillDir = path.join(targetDir, skillId);
    await fs.mkdir(skillDir, { recursive: true });

    // Write SKILL.md
    const skillPath = path.join(skillDir, "SKILL.md");
    await fs.writeFile(skillPath, skillContent, "utf-8");

    return NextResponse.json({
      success: true,
      skillId,
      name,
      path: skillPath,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.errors },
        { status: 400 }
      );
    }
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}
