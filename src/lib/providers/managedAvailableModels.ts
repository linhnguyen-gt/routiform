import { getModelsByProviderId } from "@/shared/constants/models";
import { isClaudeCodeCompatibleProvider } from "@/shared/constants/providers";

type ManagedAvailableModel = {
  id?: string;
  name?: string;
};

export function getCompatibleFallbackModels(
  _providerId: string,
  fallbackModels: ManagedAvailableModel[] = []
): ManagedAvailableModel[] | undefined {
  if (isClaudeCodeCompatibleProvider(_providerId)) return getModelsByProviderId("claude");
  return fallbackModels;
}

export function compatibleProviderSupportsModelImport(providerId: string): boolean {
  return !isClaudeCodeCompatibleProvider(providerId);
}
