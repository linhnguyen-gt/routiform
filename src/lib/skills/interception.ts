import { skillExecutor } from "./executor";
import { detectProvider } from "./injection";

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ExecutionContext {
  apiKeyId: string;
  sessionId: string;
  requestId: string;
}

export async function interceptToolCalls(
  toolCalls: ToolCall[],
  context: ExecutionContext
): Promise<{ id: string; result: unknown }[]> {
  const results = await Promise.all(
    toolCalls.map(async (call) => {
      try {
        const [name, version] = call.name.includes("@")
          ? call.name.split("@")
          : [call.name, "latest"];

        const skillName = version === "latest" ? name : `${name}@${version}`;

        const execution = await skillExecutor.execute(skillName, call.arguments, {
          apiKeyId: context.apiKeyId,
          sessionId: context.sessionId,
        });

        return {
          id: call.id,
          result: execution.output,
        };
      } catch (err) {
        return {
          id: call.id,
          result: { error: err instanceof Error ? err.message : String(err) },
        };
      }
    })
  );

  return results;
}

export function extractToolCalls(response: unknown, modelId: string): ToolCall[] {
  const provider = detectProvider(modelId);
  const resp = response as Record<string, unknown>;

  switch (provider) {
    case "openai":
      return (Array.isArray(resp.tool_calls) ? resp.tool_calls : []).map((tc: unknown) => {
        const toolCall = tc as Record<string, unknown>;
        const func = toolCall.function as Record<string, unknown> | undefined;
        return {
          id: String(toolCall.id || `call_${Date.now()}`),
          name: String(func?.name || ""),
          arguments: parseArguments(String(func?.arguments || "{}")),
        };
      });

    case "anthropic":
      return (Array.isArray(resp.content) ? resp.content : [])
        .filter((c: unknown) => {
          const content = c as Record<string, unknown>;
          return content.type === "tool_use";
        })
        .map((tc: unknown) => {
          const toolCall = tc as Record<string, unknown>;
          return {
            id: String(toolCall.id),
            name: String(toolCall.name),
            arguments: (toolCall.input as Record<string, unknown>) || {},
          };
        });

    case "google":
      return (Array.isArray(resp.functionCalls) ? resp.functionCalls : []).map((fc: unknown) => {
        const funcCall = fc as Record<string, unknown>;
        return {
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: String(funcCall.name),
          arguments: (funcCall.args as Record<string, unknown>) || {},
        };
      });

    default:
      return [];
  }
}

function parseArguments(args: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof args === "object") {
    return args;
  }

  try {
    return JSON.parse(args);
  } catch {
    return {};
  }
}

export async function handleToolCallExecution(
  response: unknown,
  modelId: string,
  context: ExecutionContext
): Promise<unknown> {
  const toolCalls = extractToolCalls(response, modelId);

  if (toolCalls.length === 0) {
    return response;
  }

  const results = await interceptToolCalls(toolCalls, context);

  const provider = detectProvider(modelId);

  switch (provider) {
    case "openai":
      return {
        ...(response as object),
        tool_results: results.map((r) => ({
          tool_call_id: r.id,
          output: JSON.stringify(r.result),
        })),
      };

    case "anthropic":
      const content = (response as Record<string, unknown>).content;
      return {
        ...(response as object),
        content: [
          ...(Array.isArray(content) ? content : []),
          ...results.map((r) => ({
            type: "tool_result",
            tool_use_id: r.id,
            content: JSON.stringify(r.result),
          })),
        ],
      };

    default:
      return response;
  }
}
