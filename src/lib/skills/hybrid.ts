export type ExecutionMode = "direct" | "sandbox" | "hybrid";

export interface HybridConfig {
  defaultMode: ExecutionMode;
  autoUpgrade: boolean;
  maxDirectDuration: number;
}

const defaultHybridConfig: HybridConfig = {
  defaultMode: "direct",
  autoUpgrade: true,
  maxDirectDuration: 5000,
};

export class HybridExecutor {
  private config: HybridConfig;
  private directExecutor: unknown;
  private sandboxRunner: unknown;

  constructor(config: Partial<HybridConfig> = {}) {
    this.config = { ...defaultHybridConfig, ...config };
  }

  setConfig(config: Partial<HybridConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async execute(skillName: string, input: unknown, context: unknown): Promise<unknown> {
    const _startTime = Date.now();
    const estimatedDuration =
      typeof (input as Record<string, unknown>).estimatedDuration === "number"
        ? ((input as Record<string, unknown>).estimatedDuration as number)
        : 0;

    if (this.shouldUseSandbox(estimatedDuration)) {
      return this.executeInSandbox(skillName, input, context);
    }

    try {
      return await this.executeDirect(skillName, input, context);
    } catch (err) {
      if (this.config.autoUpgrade && this.isRetryable(err)) {
        return this.executeInSandbox(skillName, input, context);
      }
      throw err;
    }
  }

  private shouldUseSandbox(estimatedDuration: number): boolean {
    if (this.config.defaultMode === "sandbox") return true;
    if (this.config.defaultMode === "direct") return false;
    return estimatedDuration > this.config.maxDirectDuration;
  }

  private async executeDirect(
    _skillName: string,
    _input: unknown,
    _context: unknown
  ): Promise<unknown> {
    return { mode: "direct", result: {} };
  }

  private async executeInSandbox(
    _skillName: string,
    _input: unknown,
    _context: unknown
  ): Promise<unknown> {
    return { mode: "sandbox", result: {} };
  }

  private isRetryable(err: unknown): boolean {
    const error = err as { message?: string };
    if (error?.message?.includes("timeout")) return true;
    if (error?.message?.includes("memory")) return true;
    return false;
  }
}

export const hybridExecutor = new HybridExecutor();
