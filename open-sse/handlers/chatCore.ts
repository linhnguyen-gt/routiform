export {
  isTokenExpiringSoon,
  sanitizeGithubInitiatorHeaderValue,
  shouldBridgeGithubClaudeOpenAiThroughClaudeFormat,
  shouldUseNativeCodexPassthrough,
} from "./chat-core/chat-core-flags.ts";

import type { ChatCoreHandlerResult, HandleChatCoreArgs } from "./chat-core/chat-core-pipeline.ts";
import { runChatCoreOrchestrator } from "./chat-core/chat-core-orchestrator.ts";

/**
 * Core chat handler - shared between SSE and Worker
 * Returns { success, response, status, error } for caller to handle fallback
 */
export async function handleChatCore(args: HandleChatCoreArgs): Promise<ChatCoreHandlerResult> {
  return runChatCoreOrchestrator(args);
}

export type { ChatCoreHandlerResult } from "./chat-core/chat-core-pipeline.ts";
