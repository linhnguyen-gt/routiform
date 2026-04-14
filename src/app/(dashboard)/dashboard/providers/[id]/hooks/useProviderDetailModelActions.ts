import { useCallback } from "react";
import { formatProviderModelsErrorResponse } from "../../providerDetailApiUtils";
import type { ProviderDetailActionProps } from "../types/actions";
import type { ModelCompatSavePatch } from "../types/compat";

export function useProviderDetailModelActions({
  providerId,
  modelMeta,
  customMap,
  fetchProviderModelMeta,
  notify,
  t,
  setCompatSavingModelId,
}: Pick<
  ProviderDetailActionProps,
  "providerId" | "modelMeta" | "customMap" | "fetchProviderModelMeta" | "notify" | "t"
> & {
  setCompatSavingModelId: (id: string | null) => void;
}) {
  const saveModelCompatFlags = useCallback(
    async (modelId: string, patch: ModelCompatSavePatch) => {
      setCompatSavingModelId(modelId);
      try {
        const c = customMap.get(modelId) as Record<string, unknown> | undefined;
        let body: Record<string, unknown>;
        const onlyCompatByProtocol =
          patch.compatByProtocol &&
          patch.normalizeToolCallId === undefined &&
          patch.preserveOpenAIDeveloperRole === undefined &&
          !("upstreamHeaders" in patch);

        if (c) {
          if (onlyCompatByProtocol) {
            body = {
              provider: providerId,
              modelId,
              compatByProtocol: patch.compatByProtocol,
            };
          } else {
            body = {
              provider: providerId,
              modelId,
              modelName: (c.name as string) || modelId,
              source: (c.source as string) || "manual",
              apiFormat: (c.apiFormat as string) || "chat-completions",
              supportedEndpoints:
                Array.isArray(c.supportedEndpoints) && (c.supportedEndpoints as unknown[]).length
                  ? c.supportedEndpoints
                  : ["chat"],
              normalizeToolCallId:
                patch.normalizeToolCallId !== undefined
                  ? patch.normalizeToolCallId
                  : Boolean(c.normalizeToolCallId),
              preserveOpenAIDeveloperRole:
                patch.preserveOpenAIDeveloperRole !== undefined
                  ? patch.preserveOpenAIDeveloperRole
                  : Object.prototype.hasOwnProperty.call(c, "preserveOpenAIDeveloperRole")
                    ? Boolean(c.preserveOpenAIDeveloperRole)
                    : true,
            };
            if (patch.compatByProtocol) body.compatByProtocol = patch.compatByProtocol;
          }
        } else {
          body = { provider: providerId, modelId, ...patch };
        }
        const res = await fetch("/api/provider-models", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const detail = await formatProviderModelsErrorResponse(res);
          notify.error(
            detail ? `${t("failedSaveCustomModel")} — ${detail}` : t("failedSaveCustomModel")
          );
          return;
        }
      } catch {
        notify.error(t("failedSaveCustomModel"));
        return;
      } finally {
        setCompatSavingModelId(null);
      }
      try {
        await fetchProviderModelMeta();
      } catch {
        /* refresh failure is non-critical — data was already saved */
      }
    },
    [providerId, customMap, fetchProviderModelMeta, notify, t, setCompatSavingModelId]
  );

  return { saveModelCompatFlags };
}
