"use client";

import { CardSkeleton, Button, Toggle } from "@/shared/components";
import { useTranslations } from "next-intl";
import { ExpirationBanner } from "./components/ExpirationBanner";
import { ProviderCard } from "./components/ProviderCard";
import { ApiKeyProviderCard } from "./components/ApiKeyProviderCard";
import { ProvidersHeroHeader } from "./components/ProvidersHeroHeader";
import { ProvidersStatsCards } from "./components/ProvidersStatsCards";
import { ProviderSectionHeader } from "./components/ProviderSectionHeader";
import { CompatibleProvidersEmptyState } from "./components/CompatibleProvidersEmptyState";
import { ProviderTestResultsModal } from "./components/ProviderTestResultsModal";
import { AddOpenAICompatibleModal } from "./components/AddOpenAICompatibleModal";
import { AddAnthropicCompatibleModal } from "./components/AddAnthropicCompatibleModal";
import { AddCcCompatibleModal } from "./components/AddCcCompatibleModal";
import { useProvidersPageData } from "./hooks/useProvidersPageData";
import { ADD_CC_COMPATIBLE_LABEL } from "./provider-page-helpers.tsx";
import { useState } from "react";

export default function ProvidersPageClient() {
  const t = useTranslations("providers");
  const tc = useTranslations("common");
  const data = useProvidersPageData();

  const [showAddCompatibleModal, setShowAddCompatibleModal] = useState(false);
  const [showAddAnthropicCompatibleModal, setShowAddAnthropicCompatibleModal] = useState(false);
  const [showAddCcCompatibleModal, setShowAddCcCompatibleModal] = useState(false);

  // Compute stats for hero + stats cards
  const totalProviders =
    data.oauthProviderEntries.length +
    data.apiKeyProviderEntries.length +
    data.compatibleProviderEntries.length;

  const connectedCount =
    data.oauthProviderEntries.filter((e) => (e.stats as any).connected > 0).length +
    data.apiKeyProviderEntries.filter((e) => (e.stats as any).connected > 0).length +
    data.compatibleProviderEntries.filter((e) => (e.stats as any).connected > 0).length;

  const errorCount =
    data.oauthProviderEntries.filter((e) => (e.stats as any).error > 0).length +
    data.apiKeyProviderEntries.filter((e) => (e.stats as any).error > 0).length +
    data.compatibleProviderEntries.filter((e) => (e.stats as any).error > 0).length;

  const compatibleCount = data.compatibleProviderEntries.length;

  if (data.loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Hero Header */}
      <ProvidersHeroHeader
        totalProviders={totalProviders}
        connectedCount={connectedCount}
        onTestAll={() => data.handleBatchTest("all")}
        testing={!!data.testingMode}
        onImportZed={data.handleZedImport}
        importingZed={data.importingZed}
      />

      {/* Stats Cards */}
      <ProvidersStatsCards
        totalProviders={totalProviders}
        connectedCount={connectedCount}
        errorCount={errorCount}
        compatibleCount={compatibleCount}
      />

      {/* Expiration Banner */}
      {data.expirations && <ExpirationBanner expirations={data.expirations} />}

      {/* ─── OAuth Providers ─── */}
      <section className="flex flex-col gap-4">
        <ProviderSectionHeader
          title={t("oauthProviders")}
          authType="oauth"
          dotColor="bg-blue-500"
          dotLabel={t("oauthLabel")}
          showConfiguredOnly={data.showConfiguredOnly}
          onToggleConfiguredOnly={data.setShowConfiguredOnly}
          showConfiguredToggle
          showModelAvailability
          testingMode={data.testingMode}
          testModeKey="oauth"
          onTestAll={() => data.handleBatchTest("oauth")}
          testAllLabel={t("testAll")}
          testAllAriaLabel={t("testAllOAuth")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {data.oauthProviderEntries.map(
            ({ providerId, provider, stats, displayAuthType, toggleAuthType }) => (
              <ProviderCard
                key={providerId}
                providerId={providerId}
                provider={provider as any}
                stats={stats as any}
                authType={displayAuthType}
                onToggle={(active) => data.handleToggleProvider(providerId, toggleAuthType, active)}
              />
            )
          )}
        </div>
      </section>

      {/* ─── API Key Providers ─── */}
      <section className="flex flex-col gap-4">
        <ProviderSectionHeader
          title={t("apiKeyProviders")}
          authType="apikey"
          dotColor="bg-amber-500"
          dotLabel={t("apiKeyLabel")}
          showConfiguredOnly={data.showConfiguredOnly}
          onToggleConfiguredOnly={data.setShowConfiguredOnly}
          testingMode={data.testingMode}
          testModeKey="apikey"
          onTestAll={() => data.handleBatchTest("apikey")}
          testAllLabel={t("testAll")}
          testAllAriaLabel={t("testAllApiKey")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {data.apiKeyProviderEntries.map(
            ({ providerId, provider, stats, displayAuthType, toggleAuthType }) => (
              <ApiKeyProviderCard
                key={providerId}
                providerId={providerId}
                provider={provider as any}
                stats={stats as any}
                authType={displayAuthType}
                onToggle={(active) => data.handleToggleProvider(providerId, toggleAuthType, active)}
              />
            )
          )}
        </div>
      </section>

      {/* ─── Compatible Providers ─── */}
      <section className="flex flex-col gap-4">
        <ProviderSectionHeader
          title={t("compatibleProviders")}
          authType="compatible"
          dotColor="bg-orange-500"
          dotLabel={t("compatibleLabel")}
          showConfiguredOnly={data.showConfiguredOnly}
          onToggleConfiguredOnly={data.setShowConfiguredOnly}
          testingMode={data.testingMode}
          testModeKey="compatible"
          onTestAll={
            data.compatibleProviders.length > 0 ||
            data.anthropicCompatibleProviders.length > 0 ||
            data.ccCompatibleProviders.length > 0
              ? () => data.handleBatchTest("compatible")
              : undefined
          }
          testAllLabel={t("testAll")}
          testAllAriaLabel={t("testAllCompatible")}
          actions={
            <div className="flex flex-wrap gap-2">
              {data.ccCompatibleProviderEnabled && (
                <Button size="sm" icon="add" onClick={() => setShowAddCcCompatibleModal(true)}>
                  {ADD_CC_COMPATIBLE_LABEL}
                </Button>
              )}
              <Button size="sm" icon="add" onClick={() => setShowAddAnthropicCompatibleModal(true)}>
                {t("addAnthropicCompatible")}
              </Button>
              <Button size="sm" icon="add" onClick={() => setShowAddCompatibleModal(true)}>
                {t("addOpenAICompatible")}
              </Button>
            </div>
          }
        />
        {data.compatibleProviders.length === 0 &&
        data.anthropicCompatibleProviders.length === 0 &&
        data.ccCompatibleProviders.length === 0 ? (
          <CompatibleProvidersEmptyState
            onAddOpenAI={() => setShowAddCompatibleModal(true)}
            onAddAnthropic={() => setShowAddAnthropicCompatibleModal(true)}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.compatibleProviderEntries.map(
              ({ providerId, provider, stats, displayAuthType, toggleAuthType }) => (
                <ApiKeyProviderCard
                  key={providerId}
                  providerId={providerId}
                  provider={provider as any}
                  stats={stats as any}
                  authType={displayAuthType}
                  onToggle={(active) =>
                    data.handleToggleProvider(providerId, toggleAuthType, active)
                  }
                />
              )
            )}
          </div>
        )}
      </section>

      {/* ─── Modals ─── */}
      <AddOpenAICompatibleModal
        isOpen={showAddCompatibleModal}
        onClose={() => setShowAddCompatibleModal(false)}
        onCreated={(node) => {
          data.setProviderNodes((prev) => [...prev, node]);
          setShowAddCompatibleModal(false);
        }}
      />
      <AddAnthropicCompatibleModal
        isOpen={showAddAnthropicCompatibleModal}
        onClose={() => setShowAddAnthropicCompatibleModal(false)}
        onCreated={(node) => {
          data.setProviderNodes((prev) => [...prev, node]);
          setShowAddAnthropicCompatibleModal(false);
        }}
      />
      {data.ccCompatibleProviderEnabled && (
        <AddCcCompatibleModal
          isOpen={showAddCcCompatibleModal}
          onClose={() => setShowAddCcCompatibleModal(false)}
          onCreated={(node) => {
            data.setProviderNodes((prev) => [...prev, node]);
            setShowAddCcCompatibleModal(false);
          }}
        />
      )}

      {/* Test Results Modal */}
      {data.testResults && (
        <ProviderTestResultsModal
          isOpen={!!data.testResults}
          onClose={() => data.setTestResults(null)}
          results={data.testResults}
        />
      )}
    </div>
  );
}
