/**
 * Kiro to OpenAI Response Translator
 * Converts Kiro/AWS CodeWhisperer streaming events to OpenAI SSE format
 */
import { FORMATS } from "../formats.ts";
import { register } from "../registry.ts";

type JsonRecord = Record<string, unknown>;

// Pattern for bracket-style tool calls: [tool_name({"key":"val"})] or [tool_name: {"key":"val"}]
const BRACKET_TOOL_PATTERN = /\[(\w+)\s*[:(]\s*(\{[\s\S]*?\})\s*\]/g;

/**
 * Parse bracket-style tool calls from content text.
 * Kiro sometimes emits tool calls as [tool_name({"param":"value"})] in assistantResponseEvent
 * instead of a dedicated toolUseEvent.
 * Note: content already streamed to the client cannot be retracted — this is best-effort
 * detection for clients that tolerate extra text alongside tool calls.
 */
function parseBracketToolCalls(
  content: string
): Array<{ name: string; arguments: string; id: string }> {
  const results: Array<{ name: string; arguments: string; id: string }> = [];
  // Use a fresh RegExp per call to avoid shared lastIndex state across concurrent requests
  const regex = new RegExp(BRACKET_TOOL_PATTERN.source, BRACKET_TOOL_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const [, name, argsStr] = match;
    try {
      JSON.parse(argsStr); // validate JSON before accepting
      results.push({
        name,
        arguments: argsStr,
        id: `call_bracket_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      });
    } catch {
      // not valid JSON args — skip
    }
  }
  return results;
}

type KiroEventChunk = JsonRecord & {
  object?: string;
  choices?: unknown[];
  _eventType?: string;
  event?: string;
  assistantResponseEvent?: { content?: string };
  reasoningContentEvent?: { content?: string };
  toolUseEvent?: KiroToolUseEvent;
  messageStopEvent?: unknown;
  usageEvent?: KiroUsageEvent;
  content?: string;
  text?: string;
};

type KiroToolUseEvent = JsonRecord & {
  toolUseId?: string;
  name?: string;
  input?: unknown;
};

type KiroUsageEvent = JsonRecord & {
  inputTokens?: number;
  outputTokens?: number;
};

type OpenAIUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type KiroResponseState = JsonRecord & {
  responseId?: string;
  created?: number;
  chunkIndex?: number;
  toolCallIndex?: number;
  model?: string;
  finishReason?: string;
  usage?: OpenAIUsage;
  fullContent?: string;
  receivedUsage?: boolean;
};

type OpenAIChunk = {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: JsonRecord;
    finish_reason: string | null;
  }>;
  usage?: OpenAIUsage;
};

/**
 * Parse Kiro SSE event and convert to OpenAI format
 * Kiro events: assistantResponseEvent, codeEvent, supplementaryWebLinksEvent, etc.
 */
export function convertKiroToOpenAI(chunk: KiroEventChunk | string, state: KiroResponseState) {
  if (!chunk) return null;

  // If chunk is already in OpenAI format (from executor transform), return as-is
  if (typeof chunk !== "string" && chunk.object === "chat.completion.chunk" && chunk.choices) {
    return chunk;
  }

  // Handle string chunk (raw SSE data)
  let data: KiroEventChunk = typeof chunk === "string" ? {} : chunk;
  if (typeof chunk === "string") {
    // Parse SSE format: event:xxx\ndata:xxx
    const lines = chunk.split("\n");
    let eventType = "";
    let eventData = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith(":event-type:")) {
        eventType = line.slice(12).trim();
      } else if (line.startsWith("data:")) {
        eventData = line.slice(5).trim();
      } else if (line.startsWith(":content-type:")) {
        // Skip content-type header
      } else if (line.trim() && !line.startsWith(":")) {
        // Raw JSON data
        eventData = line.trim();
      }
    }

    if (!eventData) return null;

    try {
      data = JSON.parse(eventData) as KiroEventChunk;
      data._eventType = eventType;
    } catch {
      // Not JSON, might be raw text
      data = { text: eventData, _eventType: eventType };
    }
  }

  // Initialize state if needed
  if (!state.responseId) {
    state.responseId = `chatcmpl-${Date.now()}`;
    state.created = Math.floor(Date.now() / 1000);
    state.chunkIndex = 0;
    state.toolCallIndex = 0;
    state.fullContent = "";
    state.receivedUsage = false;
  }

  const responseId = state.responseId;
  const created = state.created ?? Math.floor(Date.now() / 1000);
  const chunkIndex = state.chunkIndex ?? 0;

  const eventType = data._eventType || data.event || "";

  // Handle different Kiro event types
  if (eventType === "assistantResponseEvent" || data.assistantResponseEvent) {
    const content = data.assistantResponseEvent?.content || data.content || "";
    if (!content) return null;

    // Accumulate full content for bracket tool call detection and truncation detection
    state.fullContent = (state.fullContent || "") + content;

    const openaiChunk: OpenAIChunk = {
      id: responseId,
      object: "chat.completion.chunk",
      created,
      model: state.model || "kiro",
      choices: [
        {
          index: 0,
          delta: {
            ...(chunkIndex === 0 ? { role: "assistant" } : {}),
            content: content,
          },
          finish_reason: null,
        },
      ],
    };

    state.chunkIndex = chunkIndex + 1;
    return openaiChunk;
  }

  // Handle reasoning/thinking events — emit as reasoning_content so clients show thinking panel
  if (eventType === "reasoningContentEvent" || data.reasoningContentEvent) {
    const content = data.reasoningContentEvent?.content || data.content || "";
    if (!content) return null;

    const openaiChunk: OpenAIChunk = {
      id: responseId,
      object: "chat.completion.chunk",
      created,
      model: state.model || "kiro",
      choices: [
        {
          index: 0,
          delta: {
            ...(chunkIndex === 0 ? { role: "assistant" } : {}),
            reasoning_content: content,
          },
          finish_reason: null,
        },
      ],
    };

    state.chunkIndex = chunkIndex + 1;
    return openaiChunk;
  }

  // Handle tool use events
  if (eventType === "toolUseEvent" || data.toolUseEvent) {
    const toolUse = data.toolUseEvent || data;
    const toolCallId = toolUse.toolUseId || `call_${Date.now()}`;
    const toolName = toolUse.name || "";
    const toolInput = toolUse.input || {};
    const currentToolIndex = state.toolCallIndex ?? 0;

    const openaiChunk: OpenAIChunk = {
      id: responseId,
      object: "chat.completion.chunk",
      created,
      model: state.model || "kiro",
      choices: [
        {
          index: 0,
          delta: {
            ...(chunkIndex === 0 ? { role: "assistant" } : {}),
            tool_calls: [
              {
                index: currentToolIndex,
                id: toolCallId,
                type: "function",
                function: {
                  name: toolName,
                  arguments: JSON.stringify(toolInput),
                },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    };

    state.toolCallIndex = currentToolIndex + 1;
    state.chunkIndex = chunkIndex + 1;
    return openaiChunk;
  }

  // Handle completion/done events
  if (eventType === "messageStopEvent" || eventType === "done" || data.messageStopEvent) {
    // Check for bracket-style tool calls in accumulated content
    // Kiro sometimes emits tool calls as [tool_name({...})] in assistantResponseEvent
    const bracketTools =
      (state.toolCallIndex ?? 0) === 0 && typeof state.fullContent === "string"
        ? parseBracketToolCalls(state.fullContent)
        : [];

    // Detect truncation: stream ended without a usageEvent and content was produced
    const wasTruncated =
      !state.receivedUsage &&
      typeof state.fullContent === "string" &&
      state.fullContent.length > 0 &&
      bracketTools.length === 0 &&
      (state.toolCallIndex ?? 0) === 0;

    const finishReason = wasTruncated ? "length" : bracketTools.length > 0 ? "tool_calls" : "stop";
    state.finishReason = finishReason; // Mark for usage injection in stream.js

    const finishChunk: OpenAIChunk = {
      id: responseId,
      object: "chat.completion.chunk",
      created,
      model: state.model || "kiro",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: finishReason,
        },
      ],
    };

    // Include usage in final chunk if available
    if (state.usage && typeof state.usage === "object") {
      finishChunk.usage = state.usage;
    }

    // If bracket tool calls found, emit them before the finish chunk
    if (bracketTools.length > 0) {
      const toolCallsChunk: OpenAIChunk = {
        id: responseId,
        object: "chat.completion.chunk",
        created,
        model: state.model || "kiro",
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: bracketTools.map((tc, idx) => ({
                index: idx,
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: tc.arguments },
              })),
            },
            finish_reason: null,
          },
        ],
      };
      return [toolCallsChunk, finishChunk];
    }

    return finishChunk;
  }

  // Handle usage events
  if (eventType === "usageEvent" || data.usageEvent) {
    const usage = (data.usageEvent || data) as KiroUsageEvent;
    if (usage && typeof usage === "object") {
      state.receivedUsage = true;
      state.usage = {
        prompt_tokens: usage.inputTokens || 0,
        completion_tokens: usage.outputTokens || 0,
        total_tokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
      };
    }
    return null;
  }

  // Unknown event type - skip
  return null;
}

// Register translator
register(FORMATS.KIRO, FORMATS.OPENAI, undefined, convertKiroToOpenAI);
