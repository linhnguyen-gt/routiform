import { cleanJSONSchemaForAntigravity } from "./geminiHelper.ts";

type GeminiFunctionDeclaration = {
  name: string;
  description: string;
  parameters: unknown;
};

type GeminiTool = {
  functionDeclarations?: GeminiFunctionDeclaration[];
  googleSearch?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toGeminiGoogleSearchTool(tool: Record<string, unknown>): GeminiTool | null {
  if (isRecord(tool.googleSearch)) {
    return { googleSearch: tool.googleSearch };
  }
  if (tool.googleSearch !== undefined) {
    return { googleSearch: {} };
  }

  if (isRecord(tool.google_search)) {
    return { googleSearch: tool.google_search };
  }
  if (tool.google_search !== undefined) {
    return { googleSearch: {} };
  }

  const toolType = typeof tool.type === "string" ? tool.type : "";
  if (
    toolType === "googleSearch" ||
    toolType === "google_search" ||
    toolType === "web_search" ||
    toolType === "web_search_preview"
  ) {
    return { googleSearch: {} };
  }

  return null;
}

export function buildGeminiTools(tools: unknown): GeminiTool[] | undefined {
  if (!Array.isArray(tools) || tools.length === 0) {
    return undefined;
  }

  const functionDeclarations: GeminiFunctionDeclaration[] = [];
  let googleSearchTool: GeminiTool | null = null;

  for (const rawTool of tools) {
    if (!isRecord(rawTool)) {
      continue;
    }

    const normalizedGoogleSearchTool = toGeminiGoogleSearchTool(rawTool);
    if (normalizedGoogleSearchTool) {
      googleSearchTool = normalizedGoogleSearchTool;
      continue;
    }

    if (Array.isArray(rawTool.functionDeclarations)) {
      for (const fn of rawTool.functionDeclarations) {
        if (!isRecord(fn) || typeof fn.name !== "string" || !fn.name.trim()) {
          continue;
        }

        functionDeclarations.push({
          name: fn.name,
          description: typeof fn.description === "string" ? fn.description : "",
          parameters: cleanJSONSchemaForAntigravity(
            fn.parameters || { type: "object", properties: {} }
          ),
        });
      }
      continue;
    }

    if (typeof rawTool.name === "string" && rawTool.name.trim()) {
      functionDeclarations.push({
        name: rawTool.name,
        description: typeof rawTool.description === "string" ? rawTool.description : "",
        parameters: cleanJSONSchemaForAntigravity(
          rawTool.input_schema || { type: "object", properties: {} }
        ),
      });
      continue;
    }

    if (rawTool.type === "function" && isRecord(rawTool.function)) {
      const fn = rawTool.function;
      if (typeof fn.name !== "string" || !fn.name.trim()) {
        continue;
      }

      functionDeclarations.push({
        name: fn.name,
        description: typeof fn.description === "string" ? fn.description : "",
        parameters: cleanJSONSchemaForAntigravity(
          fn.parameters || { type: "object", properties: {} }
        ),
      });
    }
  }

  if (googleSearchTool && functionDeclarations.length > 0) {
    console.warn(
      `[GeminiTools] Removing ${functionDeclarations.length} functionDeclarations because googleSearch cannot be mixed with Gemini function tools`
    );
  }

  if (googleSearchTool) {
    return [googleSearchTool];
  }

  if (functionDeclarations.length > 0) {
    return [{ functionDeclarations }];
  }

  return undefined;
}
