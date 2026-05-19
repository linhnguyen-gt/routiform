import { spawn } from "child_process";
import {
  BaseExecutor,
  type ExecutorLog,
  type ProviderCredentials,
  type ExecuteInput,
} from "./base.ts";
import { PROVIDERS } from "../config/constants.ts";

/**
 * DevinExecutor — runs `devin --print <prompt>` as a subprocess.
 *
 * Devin CLI manages its own auth (credentials at ~/.local/share/devin/credentials.toml)
 * and model selection. We spawn it with --print for non-interactive output.
 *
 * Auth: the windsurf_api_key token is validated at import time; the CLI uses it
 * automatically from its credential store — no token injection needed here.
 */
export class DevinExecutor extends BaseExecutor {
  constructor() {
    super("devin", PROVIDERS.devin);
  }

  // Override execute entirely — bypass HTTP and use subprocess instead.
  async execute(
    input: ExecuteInput
  ): Promise<{
    response: Response;
    url: string;
    headers: Record<string, string>;
    transformedBody: unknown;
  }> {
    const { model, body, stream, signal, log } = input;
    const messages = (body as Record<string, unknown>).messages as
      | Array<{ role: string; content: string }>
      | undefined;

    // Build prompt from messages
    const prompt = buildPrompt(messages || []);
    const devinBin = findDevinBin();

    log?.info?.("DEVIN_EXEC", `Spawning: ${devinBin} --print [prompt] (model hint: ${model})`);

    const responseText = await runDevinPrint(devinBin, prompt, model, signal ?? null, log ?? null);

    // Wrap in OpenAI-compatible response
    const openaiResponse = buildOpenAIResponse(responseText, model, stream);
    const responseBody = stream ? buildSSEStream(openaiResponse) : JSON.stringify(openaiResponse);

    const response = new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": stream ? "text/event-stream" : "application/json",
      },
    });

    return { response, url: "devin://subprocess", headers: {}, transformedBody: prompt };
  }

  buildUrl() {
    return "devin://subprocess";
  }
  buildHeaders() {
    return {};
  }
  transformRequest(_model: string, body: Record<string, unknown>) {
    return body;
  }

  async refreshCredentials(_credentials: ProviderCredentials, log: ExecutorLog | null) {
    log?.info?.("TOKEN_REFRESH", "Devin: run `devin auth login` to re-authenticate.");
    return null;
  }

  needsRefresh(credentials: ProviderCredentials): boolean {
    if (credentials.expiresAt) {
      return new Date(credentials.expiresAt).getTime() - Date.now() < 5 * 60 * 1000;
    }
    return false;
  }
}

function findDevinBin(): string {
  // Common install locations for Devin CLI
  const candidates = [
    process.env.DEVIN_BIN,
    `${process.env.HOME}/.local/bin/devin`,
    "/usr/local/bin/devin",
    "/opt/homebrew/bin/devin",
    "devin",
  ].filter(Boolean) as string[];
  return candidates[0];
}

function buildPrompt(messages: Array<{ role: string; content: string }>): string {
  if (messages.length === 0) return "";

  // For single user message, pass directly
  if (messages.length === 1 && messages[0].role === "user") {
    return messages[0].content;
  }

  // For multi-turn, format as conversation
  return messages
    .map((m) => {
      const role = m.role === "assistant" ? "Assistant" : m.role === "system" ? "System" : "User";
      return `${role}: ${m.content}`;
    })
    .join("\n\n");
}

function runDevinPrint(
  bin: string,
  prompt: string,
  model: string,
  signal: AbortSignal | null,
  log: ExecutorLog | null
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["--print", prompt];

    // Pass model hint if it's a known Devin model name (not an OpenAI/Anthropic model ID)
    const devinModels = [
      "swe",
      "swe-1-6",
      "swe-1-6-fast",
      "opus",
      "sonnet",
      "gpt",
      "gemini",
      "codex",
    ];
    if (model && devinModels.some((m) => model.toLowerCase().includes(m))) {
      args.unshift("--model", model);
    }

    log?.info?.("DEVIN_SPAWN", `${bin} ${args.slice(0, 2).join(" ")} ...`);

    const child = spawn(bin, args, {
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      reject(
        new Error(
          `Failed to spawn devin CLI: ${err.message}. Ensure Devin is installed and run \`devin auth login\`.`
        )
      );
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const msg = stderr.trim() || `devin exited with code ${code}`;
        reject(new Error(msg));
        return;
      }
      resolve(stdout.trim());
    });

    // Respect abort signal
    if (signal) {
      signal.addEventListener("abort", () => {
        child.kill("SIGTERM");
        reject(new Error("Request aborted"));
      });
    }
  });
}

function buildOpenAIResponse(text: string, model: string, _stream: boolean) {
  return {
    id: `devin-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

function buildSSEStream(response: ReturnType<typeof buildOpenAIResponse>): ReadableStream {
  const content = response.choices[0].message.content;
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      // Send content as a single delta chunk
      const chunk = {
        id: response.id,
        object: "chat.completion.chunk",
        created: response.created,
        model: response.model,
        choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));

      // Send finish chunk
      const finishChunk = {
        ...chunk,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(finishChunk)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}
