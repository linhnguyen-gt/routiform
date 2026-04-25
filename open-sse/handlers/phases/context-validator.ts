import { HTTP_STATUS } from "../../config/constants.ts";
import { recordContextCompression, recordContextRejection } from "../../services/comboMetrics.ts";
import {
  compressContext,
  estimateRequestTokens,
  validateContextLimit,
} from "../../services/contextManager.ts";
import { createErrorResult } from "../../utils/error.ts";
import { isProxyContextCompressionEnabled } from "../../services/contextValidationSettings.ts";

/**
 * Result of context validation and compression.
 */
type JsonRecord = Record<string, unknown>;
const TOOL_WORKFLOW_SOFT_LIMIT = 80000;

function isToolWorkflowPayload(body: JsonRecord): boolean {
  if (!Array.isArray(body.tools) || body.tools.length === 0) return false;
  if (!Array.isArray(body.messages)) return true;

  return (body.messages as JsonRecord[]).some((message) => {
    if (!message || typeof message !== "object") return false;
    if (message.role === "tool") return true;
    if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) return true;
    if (!Array.isArray(message.content)) return false;
    return (message.content as JsonRecord[]).some((block) => {
      if (!block || typeof block !== "object") return false;
      const type = typeof block.type === "string" ? block.type : "";
      return type === "tool_result" || type === "tool_use";
    });
  });
}

export interface ContextValidationResult {
  /** Whether validation passed (context is within limits) */
  valid: boolean;
  /** Updated request body (may be compressed) */
  body: JsonRecord;
  /** Error result if validation failed */
  error?: {
    success: false;
    status: number;
    error: string;
  };
}

/**
 * Validates request context size and attempts compression if needed.
 *
 * Unless proxy context compression is enabled (Dashboard → AI → Request context,
 * or env `ROUTIFORM_CONTEXT_VALIDATION`), returns the body unchanged.
 *
 * Phase 1 & 2: Context Validation & Compression
 * - Validates context window BEFORE translation to catch oversized requests early
 * - Attempts compression if request exceeds limits
 * - Tracks compression metrics for combo requests
 * - Returns error if context still exceeds limits after compression
 *
 * @param body - Request body to validate
 * @param provider - Provider name for context limit lookup
 * @param model - Model name for context limit lookup
 * @param combo - Combo configuration (if applicable)
 * @param comboName - Combo name for metrics tracking
 * @param reqLogger - Request logger for dashboard visibility
 * @param log - Logger instance
 * @param persistFailureUsage - Callback to persist failure metrics
 * @returns Validation result with updated body or error
 */
export async function validateAndCompressContext({
  body,
  provider,
  model,
  combo,
  comboName,
  reqLogger,
  log,
  persistFailureUsage,
}: {
  body: JsonRecord;
  provider: string;
  model: string;
  combo?: Record<string, unknown> | null;
  comboName?: string;
  reqLogger?: {
    logContextValidation?: (data: {
      originalTokens: number;
      limit: number;
      exceeded: number;
      compressed: boolean;
      finalTokens: number;
      layers?: string[];
      rejected: boolean;
    }) => void;
  } | null;
  log?: {
    info?: (tag: string, message: string) => void;
    warn?: (tag: string, message: string) => void;
  } | null;
  persistFailureUsage: (statusCode: number, errorCode?: string | null) => void;
}): Promise<ContextValidationResult> {
  const compressionEnabled = await isProxyContextCompressionEnabled();
  const validation = validateContextLimit(body, provider, model, combo);

  if (!compressionEnabled) {
    // Safety guard: very large tool workflows are prone to "promise-only" model replies
    // (e.g. "doing now") without emitting tool calls. We keep this lightweight and only
    // apply when tools are present and prompt context is abnormally large.
    if (validation.estimatedTokens > TOOL_WORKFLOW_SOFT_LIMIT && isToolWorkflowPayload(body)) {
      log?.warn?.(
        "CONTEXT",
        `Tool workflow soft-limit triggered: ${validation.estimatedTokens} > ${TOOL_WORKFLOW_SOFT_LIMIT}; applying emergency compression`
      );

      const emergencyLimit = Math.min(validation.rawLimit, TOOL_WORKFLOW_SOFT_LIMIT);
      const compressionResult = compressContext(body, {
        provider,
        model,
        maxTokens: emergencyLimit,
      });

      const finalTokens = estimateRequestTokens(compressionResult.body);
      if (finalTokens <= TOOL_WORKFLOW_SOFT_LIMIT) {
        reqLogger?.logContextValidation?.({
          originalTokens: validation.estimatedTokens,
          limit: TOOL_WORKFLOW_SOFT_LIMIT,
          exceeded: Math.max(0, validation.estimatedTokens - TOOL_WORKFLOW_SOFT_LIMIT),
          compressed: true,
          finalTokens,
          layers: compressionResult.stats.layers?.map((l) => l.name) || [],
          rejected: false,
        });
        return { valid: true, body: compressionResult.body };
      }

      reqLogger?.logContextValidation?.({
        originalTokens: validation.estimatedTokens,
        limit: TOOL_WORKFLOW_SOFT_LIMIT,
        exceeded: Math.max(0, validation.estimatedTokens - TOOL_WORKFLOW_SOFT_LIMIT),
        compressed: true,
        finalTokens,
        rejected: true,
      });
      persistFailureUsage(HTTP_STATUS.BAD_REQUEST, "tool_workflow_context_too_large");
      return {
        valid: false,
        body: compressionResult.body,
        error: createErrorResult(
          HTTP_STATUS.BAD_REQUEST,
          `Tool workflow context is too large (${validation.estimatedTokens} tokens). Please reduce history or tool outputs.`
        ),
      };
    }

    return { valid: true, body };
  }

  if (!validation.valid) {
    log?.warn?.(
      "CONTEXT",
      `Request exceeds context limit: ${validation.estimatedTokens} > ${validation.limit} (exceeded by ${validation.exceeded} tokens)`
    );

    // Try compression
    const compressionResult = compressContext(body, {
      provider,
      model,
      maxTokens: validation.limit,
    });

    if (compressionResult.compressed) {
      body = compressionResult.body;
      const newValidation = validateContextLimit(body, provider, model, combo);

      if (newValidation.valid) {
        log?.info?.(
          "CONTEXT",
          `Compressed: ${compressionResult.stats.original} → ${compressionResult.stats.final} tokens (limit=${validation.limit})`
        );

        // Track compression metrics
        if (comboName) {
          recordContextCompression(
            comboName,
            `${provider}/${model}`,
            compressionResult.stats.original,
            compressionResult.stats.final
          );
        }

        // Log successful context compression to reqLogger for dashboard visibility
        reqLogger?.logContextValidation?.({
          originalTokens: validation.estimatedTokens,
          limit: validation.limit,
          exceeded: validation.exceeded,
          compressed: true,
          finalTokens: newValidation.estimatedTokens,
          layers: compressionResult.stats.layers?.map((l) => l.name) || [],
          rejected: false,
        });

        return { valid: true, body };
      } else {
        // Still oversized after compression - track rejection
        if (comboName) {
          recordContextRejection(comboName, `${provider}/${model}`);
        }

        // Log context rejection to reqLogger for dashboard visibility
        reqLogger?.logContextValidation?.({
          originalTokens: validation.estimatedTokens,
          limit: validation.limit,
          exceeded: validation.exceeded,
          compressed: true,
          finalTokens: newValidation.estimatedTokens,
          rejected: true,
        });

        persistFailureUsage(HTTP_STATUS.BAD_REQUEST, "context_length_exceeded");

        return {
          valid: false,
          body,
          error: createErrorResult(
            HTTP_STATUS.BAD_REQUEST,
            `Request exceeds context limit even after compression: ${newValidation.estimatedTokens} > ${validation.limit} tokens. Please reduce message history or input size.`
          ),
        };
      }
    } else {
      // Compression didn't help or wasn't applicable - track rejection
      if (comboName) {
        recordContextRejection(comboName, `${provider}/${model}`);
      }

      persistFailureUsage(HTTP_STATUS.BAD_REQUEST, "context_length_exceeded");

      return {
        valid: false,
        body,
        error: createErrorResult(
          HTTP_STATUS.BAD_REQUEST,
          `Request exceeds context limit: ${validation.estimatedTokens} > ${validation.limit} tokens. Please reduce message history or input size.`
        ),
      };
    }
  }

  return { valid: true, body };
}
