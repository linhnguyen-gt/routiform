import { skillRegistry } from "./registry";
import { SkillExecution, SkillStatus, SkillHandler } from "./types";
import { getDbInstance } from "../db/core";
import { getSettings } from "../db/settings";
import { randomUUID } from "crypto";

class SkillExecutor {
  private static instance: SkillExecutor;
  private handlers: Map<string, SkillHandler> = new Map();
  private timeout: number = 30000;
  private maxRetries: number = 3;

  private constructor() {}

  static getInstance(): SkillExecutor {
    if (!SkillExecutor.instance) {
      SkillExecutor.instance = new SkillExecutor();
    }
    return SkillExecutor.instance;
  }

  registerHandler(name: string, handler: SkillHandler): void {
    this.handlers.set(name, handler);
  }

  setTimeout(ms: number): void {
    this.timeout = ms;
  }

  setMaxRetries(count: number): void {
    this.maxRetries = count;
  }

  async execute(
    skillName: string,
    input: Record<string, unknown>,
    context: { apiKeyId: string; sessionId?: string }
  ): Promise<SkillExecution> {
    const settings = await getSettings();
    if (settings.skillsEnabled === false) {
      throw new Error("Skills execution is disabled. Enable Skills in Settings > AI.");
    }

    const skill = skillRegistry.getSkill(skillName, context.apiKeyId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    if (!skill.enabled) {
      throw new Error(`Skill is disabled: ${skillName}`);
    }

    const db = getDbInstance();
    const executionId = randomUUID();
    const startTime = Date.now();

    try {
      db.prepare(
        `INSERT INTO skill_executions (id, skill_id, api_key_id, session_id, input, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        executionId,
        skill.id,
        context.apiKeyId,
        context.sessionId || null,
        JSON.stringify(input),
        SkillStatus.RUNNING,
        new Date().toISOString()
      );

      const handler = this.handlers.get(skill.handler);
      if (!handler) {
        throw new Error(`Handler not found: ${skill.handler}`);
      }

      let output: Record<string, unknown> | null = null;
      let errorMessage: string | null = null;
      let status = SkillStatus.SUCCESS;

      try {
        const result = await this.executeWithTimeout(
          handler(input, { apiKeyId: context.apiKeyId, sessionId: context.sessionId || "" })
        );
        output = result;
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
        status = SkillStatus.ERROR;
      }

      const durationMs = Date.now() - startTime;

      db.prepare(
        `UPDATE skill_executions SET output = ?, status = ?, error_message = ?, duration_ms = ? WHERE id = ?`
      ).run(output ? JSON.stringify(output) : null, status, errorMessage, durationMs, executionId);

      return {
        id: executionId,
        skillId: skill.id,
        apiKeyId: context.apiKeyId,
        sessionId: context.sessionId || "",
        input,
        output,
        status,
        errorMessage,
        durationMs,
        createdAt: new Date(),
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      db.prepare(
        `UPDATE skill_executions SET status = ?, error_message = ?, duration_ms = ? WHERE id = ?`
      ).run(SkillStatus.ERROR, errorMessage, durationMs, executionId);

      throw err;
    }
  }

  private async executeWithTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Skill execution timed out")), this.timeout)
      ),
    ]);
  }

  getExecution(executionId: string): SkillExecution | undefined {
    const db = getDbInstance();
    const row = db.prepare("SELECT * FROM skill_executions WHERE id = ?").get(executionId) as
      | Record<string, unknown>
      | undefined;
    if (!row) return undefined;

    return {
      id: String(row.id),
      skillId: String(row.skill_id),
      apiKeyId: String(row.api_key_id),
      sessionId: String(row.session_id || ""),
      input: JSON.parse(String(row.input)),
      output: row.output ? JSON.parse(String(row.output)) : null,
      status: row.status as SkillStatus,
      errorMessage: row.error_message ? String(row.error_message) : null,
      durationMs: typeof row.duration_ms === "number" ? row.duration_ms : 0,
      createdAt: new Date(row.created_at as string | number | Date),
    };
  }

  listExecutions(apiKeyId?: string, limit: number = 50): SkillExecution[] {
    const db = getDbInstance();
    const rows = apiKeyId
      ? db
          .prepare(
            "SELECT * FROM skill_executions WHERE api_key_id = ? ORDER BY created_at DESC LIMIT ?"
          )
          .all(apiKeyId, limit)
      : db.prepare("SELECT * FROM skill_executions ORDER BY created_at DESC LIMIT ?").all(limit);

    return (rows as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      skillId: String(row.skill_id),
      apiKeyId: String(row.api_key_id),
      sessionId: String(row.session_id || ""),
      input: JSON.parse(String(row.input)),
      output: row.output ? JSON.parse(String(row.output)) : null,
      status: row.status as SkillStatus,
      errorMessage: row.error_message ? String(row.error_message) : null,
      durationMs: typeof row.duration_ms === "number" ? row.duration_ms : 0,
      createdAt: new Date(row.created_at as string | number | Date),
    }));
  }
}

export const skillExecutor = SkillExecutor.getInstance();
