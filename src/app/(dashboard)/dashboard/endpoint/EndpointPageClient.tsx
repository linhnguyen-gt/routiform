"use client";

import { useState, useEffect, useCallback } from "react";
import type { TranslationValues } from "./types";
import { CardSkeleton, SegmentedControl } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useTranslations } from "next-intl";

// Hooks
import { useCloudSync } from "./hooks/useCloudSync";
import { useCloudflared } from "./hooks/useCloudflared";
import { useModelCatalog } from "./hooks/useModelCatalog";
import { useProtocols } from "./hooks/useProtocols";

// Components
import { EndpointUrlCard } from "./components/EndpointUrlCard";
import { CloudflaredTunnelSection } from "./components/CloudflaredTunnelSection";
import { ApiCatalogSection } from "./components/ApiCatalogSection";
import { ProtocolsSection } from "./components/ProtocolsSection";
import { ProviderModelsModal } from "./components/ProviderModelsModal";
import { EnableCloudModal, DisableCloudModal } from "./components/CloudSyncModals";

const BUILD_TIME_CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL || null;

export default function APIPageClient({ machineId }) {
  const t = useTranslations("endpoint");
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState("api");
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<{
    provider: { alias?: string; name?: string };
    id: string;
  } | null>(null);

  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);

  const { copied, copy } = useCopyToClipboard();

  // Logic Hooks
  const {
    cloudEnabled,
    cloudSyncing,
    cloudStatus,
    syncStep,
    modalSuccess,
    resolvedMachineId,
    cloudBaseUrl,
    cloudConfigured,
    loadCloudSettings,
    handleEnableCloud,
    handleConfirmDisable,
    setCloudStatus,
  } = useCloudSync(machineId, BUILD_TIME_CLOUD_URL);

  const {
    cloudflaredStatus,
    cloudflaredBusy,
    cloudflaredNotice,
    fetchCloudflaredStatus,
    handleCloudflaredAction,
    setCloudflaredNotice,
  } = useCloudflared();

  const { allModels, searchProviders, endpointData, refreshModels } = useModelCatalog();
  const { mcpStatus, a2aStatus, refreshProtocols } = useProtocols();

  useEffect(() => {
    Promise.allSettled([
      loadCloudSettings(),
      refreshModels(),
      refreshProtocols(),
      fetchCloudflaredStatus(true),
    ]).finally(() => {
      setLoading(false);
    });
  }, [loadCloudSettings, refreshModels, refreshProtocols, fetchCloudflaredStatus]);

  // Translate helper for components that need it
  const translateOrFallback = useCallback(
    (key: string, fallback: string, values?: TranslationValues) => {
      try {
        const message = values ? t(key as never, values as never) : t(key as never);
        if (!message || message === key || message === `endpoint.${key}`) {
          return fallback;
        }
        return message;
      } catch {
        return fallback;
      }
    },
    [t]
  );

  const baseUrl = typeof window !== "undefined" ? `${window.location.origin}/v1` : "/v1";

  const normalizedCloudBaseUrl = cloudBaseUrl
    ? resolvedMachineId && !cloudBaseUrl.endsWith(`/${resolvedMachineId}`)
      ? `${cloudBaseUrl}/${resolvedMachineId}`
      : cloudBaseUrl
    : null;
  const cloudEndpointNew = normalizedCloudBaseUrl ? `${normalizedCloudBaseUrl}/v1` : null;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const currentEndpoint = cloudEnabled && cloudEndpointNew ? cloudEndpointNew : baseUrl;

  const handleCloudToggle = (checked: boolean) => {
    if (checked) {
      if (!cloudConfigured) {
        setCloudStatus({
          type: "warning",
          message: "Cloud sync is not configured on this instance.",
        });
        return;
      }
      setShowCloudModal(true);
    } else {
      setShowDisableModal(true);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <EndpointUrlCard
        cloudEnabled={cloudEnabled}
        cloudSyncing={cloudSyncing}
        cloudConfigured={cloudConfigured}
        resolvedMachineId={resolvedMachineId}
        currentEndpoint={currentEndpoint}
        cloudStatus={cloudStatus}
        onCloudToggle={handleCloudToggle}
        copy={copy}
        copied={copied}
        onCloseStatus={() => setCloudStatus(null)}
      />

      <CloudflaredTunnelSection
        status={cloudflaredStatus}
        busy={cloudflaredBusy}
        notice={cloudflaredNotice}
        onAction={handleCloudflaredAction}
        onCloseNotice={() => setCloudflaredNotice(null)}
        copy={copy}
        copied={copied}
        translateOrFallback={translateOrFallback}
      />

      <div className="rounded-xl border border-border/50 bg-surface shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("sectionTitle") || "Integration Surface"}</h2>
            <p className="text-sm text-text-muted">
              {t("sectionDescription") ||
                "OpenAI-compatible APIs and operational protocol endpoints"}
            </p>
          </div>
          <SegmentedControl
            options={[
              { value: "api", label: t("tabApis") || "OpenAI-compatible APIs", icon: "api" },
              { value: "protocols", label: t("tabProtocols") || "Protocols", icon: "hub" },
            ]}
            value={viewTab}
            onChange={setViewTab}
            aria-label={t("tabsAria") || "Endpoint sections"}
          />
        </div>
      </div>

      {viewTab === "api" ? (
        <div className="rounded-xl border border-border/50 bg-surface shadow-sm p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{t("available")}</h2>
              <p className="text-sm text-text-muted">
                {t("modelsAcrossEndpoints", {
                  models: Object.values(endpointData).reduce(
                    (acc, models) => acc + models.length,
                    0
                  ),
                  endpoints:
                    [
                      endpointData.chat,
                      endpointData.embeddings,
                      endpointData.images,
                      endpointData.rerank,
                      endpointData.audioTranscription,
                      endpointData.audioSpeech,
                      endpointData.moderation,
                      endpointData.music,
                    ].filter((a) => a.length > 0).length + 2,
                })}
              </p>
            </div>
          </div>

          <ApiCatalogSection
            endpointData={endpointData}
            searchProviders={searchProviders}
            currentEndpoint={currentEndpoint}
            expandedEndpoint={expandedEndpoint}
            setExpandedEndpoint={setExpandedEndpoint}
            copy={copy}
            copied={copied}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-surface shadow-sm p-4">
          <ProtocolsSection mcpStatus={mcpStatus} a2aStatus={a2aStatus} baseUrl={baseUrl} />
        </div>
      )}

      {/* Cloud Modals */}
      <EnableCloudModal
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
        syncing={cloudSyncing}
        modalSuccess={modalSuccess}
        syncStep={syncStep as "syncing" | "verifying" | "done" | ""}
        onEnable={handleEnableCloud}
      />

      <DisableCloudModal
        isOpen={showDisableModal}
        onClose={() => setShowDisableModal(false)}
        syncing={cloudSyncing}
        syncStep={syncStep as "syncing" | "disabling" | ""}
        onConfirm={handleConfirmDisable}
      />

      {/* Provider Models Popup */}
      {selectedProvider && (
        <ProviderModelsModal
          provider={selectedProvider}
          models={allModels}
          copy={copy}
          copied={copied}
          onClose={() => setSelectedProvider(null)}
        />
      )}
    </div>
  );
}
