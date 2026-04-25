export const OFFICIAL_GITHUB_COPILOT_MODELS: Array<{
  id: string;
  name: string;
  owned_by: string;
  supportedEndpoints?: string[];
  supportsThinking?: boolean;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  targetFormat?: string;
}> = [
  { id: "gpt-4.1", name: "GPT-4.1", owned_by: "openai" },
  { id: "gpt-5-mini", name: "GPT-5 mini", owned_by: "openai" },
  { id: "gpt-5.2", name: "GPT-5.2", owned_by: "openai" },
  {
    id: "gpt-5.2-codex",
    name: "GPT-5.2-Codex",
    owned_by: "openai",
    targetFormat: "openai-responses",
  },
  {
    id: "gpt-5.3-codex",
    name: "GPT-5.3-Codex",
    owned_by: "openai",
    targetFormat: "openai-responses",
  },
  { id: "gpt-5.4", name: "GPT-5.4", owned_by: "openai" },
  {
    id: "gpt-5.4-mini",
    name: "GPT-5.4 mini",
    owned_by: "openai",
    targetFormat: "openai-responses",
  },
  { id: "gpt-5.4-nano", name: "GPT-5.4 nano", owned_by: "openai" },
  { id: "gpt-5.5", name: "GPT-5.5", owned_by: "openai" },
  {
    id: "claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    owned_by: "anthropic",
    supportsThinking: true,
  },
  { id: "claude-opus-4.5", name: "Claude Opus 4.5", owned_by: "anthropic", supportsThinking: true },
  { id: "claude-opus-4.6", name: "Claude Opus 4.6", owned_by: "anthropic", supportsThinking: true },
  {
    id: "claude-opus-4.6-fast",
    name: "Claude Opus 4.6 (fast mode) (preview)",
    owned_by: "anthropic",
    supportsThinking: true,
  },
  {
    id: "claude-opus-4.7",
    name: "Claude Opus 4.7",
    owned_by: "anthropic",
    inputTokenLimit: 200000,
    outputTokenLimit: 64000,
    supportsThinking: true,
  },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", owned_by: "anthropic", supportsThinking: true },
  {
    id: "claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    owned_by: "anthropic",
    supportsThinking: true,
  },
  {
    id: "claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    owned_by: "anthropic",
    supportsThinking: true,
  },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", owned_by: "google" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", owned_by: "google" },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", owned_by: "google" },
  { id: "grok-code-fast-1", name: "Grok Code Fast 1", owned_by: "xai" },
  { id: "raptor-mini", name: "Raptor mini", owned_by: "fine-tuned-gpt-5-mini" },
  {
    id: "goldeneye",
    name: "Goldeneye",
    owned_by: "fine-tuned-gpt-5.1-codex",
    targetFormat: "openai-responses",
  },
];
