import { HTTP_STATUS } from "../../config/constants.ts";
import { recordContextCompression, recordContextRejection } from "../../services/comboMetrics.ts";
import { compressContext, validateContextLimit } from "../../services/contextManager.ts";
import { isProxyContextCompressionEnabled } from "../../services/contextValidationSettings.ts";
import { createErrorResult } from "../../utils/error.ts";

/**
 * Result of context validation and compression.
 */
type JsonRecord = Record<string, unknown>;

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
 * Dashboard → AI → Request context controls whether the proxy may modify
 * oversized payloads before forwarding them upstream.
 * - `passthrough`: skip proxy-side validation/compression and forward unchanged
 * - `auto-compress`: validate against provider limits and shrink when needed
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
      droppedMessageCount?: number;
      truncatedToolCount?: number;
      compressedThinkingCount?: number;
      summaryInserted?: boolean;
      systemTruncated?: boolean;
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
    reqLogger?.logContextValidation?.({
      originalTokens: validation.estimatedTokens,
      limit: validation.limit,
      exceeded: validation.exceeded,
      compressed: false,
      finalTokens: validation.estimatedTokens,
      rejected: false,
    });
    return { valid: true, body };
  }

  // Proactive threshold: compress when approaching 200K even if still under hard limit
  const PROACTIVE_THRESHOLD = 200_000;
  const overHardLimit = !validation.valid;
  const overProactive = validation.estimatedTokens > PROACTIVE_THRESHOLD;

  if (!overHardLimit && !overProactive) {
    return { valid: true, body };
  }

  if (overHardLimit) {
    log?.warn?.(
      "CONTEXT",
      `Request exceeds context limit: ${validation.estimatedTokens} > ${validation.limit} (exceeded by ${validation.exceeded} tokens)`
    );
  } else {
    log?.info?.(
      "CONTEXT",
      `Proactive compression: ${validation.estimatedTokens} tokens, target ≤ ${PROACTIVE_THRESHOLD}`
    );
  }

  const compressionTarget = overHardLimit ? validation.limit : PROACTIVE_THRESHOLD;
  const compressionResult = compressContext(body, {
    provider,
    model,
    maxTokens: compressionTarget,
  });

  if (compressionResult.compressed) {
    body = compressionResult.body;
    const newValidation = validateContextLimit(body, provider, model, combo);

    if (newValidation.valid && newValidation.estimatedTokens <= compressionTarget) {
      log?.info?.(
        "CONTEXT",
        `Compressed: ${compressionResult.stats.original} → ${compressionResult.stats.final} tokens (target=${compressionTarget})`
      );

      if (comboName) {
        recordContextCompression(
          comboName,
          `${provider}/${model}`,
          compressionResult.stats.original,
          compressionResult.stats.final
        );
      }

      reqLogger?.logContextValidation?.({
        originalTokens: validation.estimatedTokens,
        limit: validation.limit,
        exceeded: validation.exceeded,
        compressed: true,
        finalTokens: newValidation.estimatedTokens,
        layers: compressionResult.stats.layers?.map((l) => l.name) || [],
        rejected: false,
        droppedMessageCount: compressionResult.stats.droppedMessageCount,
        truncatedToolCount: compressionResult.stats.truncatedToolCount,
        compressedThinkingCount: compressionResult.stats.compressedThinkingCount,
        summaryInserted: compressionResult.stats.summaryInserted,
        systemTruncated: compressionResult.stats.systemTruncated,
      });

      return { valid: true, body };
    }

    // Over hard limit + still oversized → reject
    if (overHardLimit) {
      if (comboName) recordContextRejection(comboName, `${provider}/${model}`);

      persistFailureUsage(HTTP_STATUS.BAD_REQUEST, "context_length_exceeded");
      return {
        valid: false,
        body,
        error: createErrorResult(
          HTTP_STATUS.BAD_REQUEST,
          `Request exceeds context limit even after compression: ${newValidation.estimatedTokens} > ${validation.limit} tokens.`
        ),
      };
    }

    // Proactive only + compression partially helped → allow through
    log?.info?.(
      "CONTEXT",
      `Proactive compression partially helped: ${compressionResult.stats.original} → ${compressionResult.stats.final}`
    );
    return { valid: true, body };
  }

  // No compression achieved
  if (overHardLimit) {
    if (comboName) recordContextRejection(comboName, `${provider}/${model}`);
    persistFailureUsage(HTTP_STATUS.BAD_REQUEST, "context_length_exceeded");
    return {
      valid: false,
      body,
      error: createErrorResult(
        HTTP_STATUS.BAD_REQUEST,
        `Request exceeds context limit: ${validation.estimatedTokens} > ${validation.limit} tokens.`
      ),
    };
  }

  // Proactive only + nothing to compress → allow through
  return { valid: true, body };
}
