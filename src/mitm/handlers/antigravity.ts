import type { IncomingMessage, ServerResponse } from "http";
import { createResponseDumper } from "../logger.js";
import { fetchRouter } from "./base.js";

function openaiSSEToGemini(chunk: Record<string, unknown>): Record<string, unknown> | null {
  if (!chunk || !chunk.choices || !Array.isArray(chunk.choices)) return null;

  const choice = chunk.choices[0] as Record<string, unknown> | undefined;
  if (!choice) return chunk;

  const delta = (choice.delta || {}) as Record<string, unknown>;
  const finishReason = choice.finish_reason;

  const parts: Record<string, unknown>[] = [];

  if (delta.reasoning_content) {
    parts.push({ thought: true, text: delta.reasoning_content });
  }
  if (delta.content) {
    parts.push({ text: delta.content });
  }

  const candidates: Record<string, unknown>[] = [];
  if (parts.length > 0 || finishReason) {
    const content: Record<string, unknown> = {
      role: delta.role || "model",
      parts,
    };
    const candidate: Record<string, unknown> = { content };
    if (typeof finishReason === "string") {
      candidate.finishReason = finishReason === "stop" ? "STOP" : finishReason.toUpperCase();
    }
    if (delta.tool_calls) {
      candidate.functionCalls = delta.tool_calls;
    }
    candidates.push(candidate);
  }

  const response: Record<string, unknown> = {};
  if (chunk.id) response.responseId = chunk.id;
  if (chunk.model) response.modelVersion = chunk.model;
  if (candidates.length > 0) response.candidates = candidates;

  let usageMetadata: Record<string, unknown> | null = null;
  if (chunk.usage && typeof chunk.usage === "object") {
    const u = chunk.usage as Record<string, unknown>;
    usageMetadata = {
      promptTokenCount: u.prompt_tokens || u.input_tokens || 0,
      candidatesTokenCount: u.completion_tokens || u.output_tokens || 0,
      totalTokenCount: u.total_tokens || 0,
    };
    response.usageMetadata = usageMetadata;
  }

  return Object.keys(response).length > 0 ? { response } : null;
}

async function pipeAntigravitySSE(
  routerRes: Response,
  res: ServerResponse,
  dumper: ReturnType<typeof createResponseDumper>
) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  if (!routerRes.body) {
    const text = await routerRes.text().catch(() => "");
    if (dumper) {
      dumper.writeChunk(text);
      dumper.end();
    }
    res.end(text);
    return;
  }

  const reader = routerRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (dumper) dumper.writeChunk(Buffer.from(value));
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          res.write("data: [DONE]\r\n\r\n");
          continue;
        }
        try {
          const chunk = JSON.parse(data);
          const converted = openaiSSEToGemini(chunk);
          if (converted) {
            res.write(`data: ${JSON.stringify(converted)}\r\n\r\n`);
          }
        } catch {
          res.write(`${line}\r\n\r\n`);
        }
      }
    }
  }

  if (dumper) dumper.end();
  res.end();
}

export async function intercept(
  req: IncomingMessage,
  res: ServerResponse,
  bodyBuffer: Buffer,
  mappedModel: string
) {
  const dumper = createResponseDumper(
    { url: req.url || "", headers: req.headers as Record<string, string> },
    "intercept-antigravity"
  );
  const isStream = (req.url || "").includes(":streamGenerateContent");
  try {
    const body = JSON.parse(bodyBuffer.toString());
    if (body.model) body.model = mappedModel;

    const routerRes = await fetchRouter(
      body,
      "/v1/chat/completions",
      req.headers as Record<string, string | string[] | undefined>
    );
    await pipeAntigravitySSE(routerRes, res, dumper);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[antigravity] ${msg}`);
    if (dumper) {
      dumper.writeChunk(`\n[ERROR] ${msg}\n`);
      dumper.end();
    }
    if (isStream) {
      if (!res.headersSent) res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(`data: ${JSON.stringify({ error: { message: msg } })}\r\n\r\n`);
    } else {
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: msg, type: "mitm_error" } }));
    }
  }
}
