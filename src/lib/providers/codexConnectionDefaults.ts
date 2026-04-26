import { getProviderConnections, updateProviderConnection } from "@/lib/db/providers";
import { getSettings, updateSettings } from "@/lib/db/settings";
import { getCodexRequestDefaults } from "./requestDefaults";

type JsonRecord = Record<string, unknown>;

const MIGRATION_SETTING_KEY = "codexConnectionDefaultsMigrationV1";

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function parseLegacyCodexServiceTier(value: unknown): { enabled: boolean } {
  if (typeof value === "string") {
    try {
      return parseLegacyCodexServiceTier(JSON.parse(value));
    } catch {
      return { enabled: false };
    }
  }

  const record = asRecord(value);
  return { enabled: record.enabled === true };
}

export async function migrateCodexConnectionDefaultsFromLegacySettings(): Promise<{
  migrated: boolean;
  updatedConnectionIds: string[];
  legacyFastEnabled: boolean;
}> {
  const settings = await getSettings();
  if (settings[MIGRATION_SETTING_KEY]) {
    return {
      migrated: false,
      updatedConnectionIds: [],
      legacyFastEnabled: parseLegacyCodexServiceTier(settings.codexServiceTier).enabled,
    };
  }

  const legacyFastEnabled = parseLegacyCodexServiceTier(settings.codexServiceTier).enabled;
  const codexConnections = await getProviderConnections({ provider: "codex" });
  const updatedConnectionIds: string[] = [];

  for (const connection of codexConnections) {
    const connectionId = String(connection.id);
    const providerSpecificData = asRecord(connection.providerSpecificData);
    const existingDefaults = getCodexRequestDefaults(providerSpecificData);
    const nextDefaults: JsonRecord = { ...existingDefaults };

    // NOTE: reasoningEffort is now a valid field, don't delete it
    // delete nextDefaults.reasoningEffort;
    if (legacyFastEnabled && !existingDefaults.serviceTier) {
      nextDefaults.serviceTier = "priority";
    }

    const defaultsChanged =
      // existingDefaults.reasoningEffort !== undefined ||
      nextDefaults.serviceTier !== existingDefaults.serviceTier;

    if (!defaultsChanged) continue;

    await updateProviderConnection(connectionId, {
      providerSpecificData: {
        ...providerSpecificData,
        requestDefaults: nextDefaults,
      },
    });
    updatedConnectionIds.push(connectionId);
  }

  await updateSettings({
    [MIGRATION_SETTING_KEY]: {
      completedAt: new Date().toISOString(),
      updatedConnectionIds,
      legacyFastEnabled,
    },
  });

  return {
    migrated: true,
    updatedConnectionIds,
    legacyFastEnabled,
  };
}
