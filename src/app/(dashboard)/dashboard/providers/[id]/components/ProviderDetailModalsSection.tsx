"use client";

import {
  CursorAuthModal,
  KiroOAuthWrapper,
  OAuthModal,
  ProxyConfigModal,
} from "@/shared/components";
import { ProviderDetailAddApiKeyModal } from "../../components/ProviderDetailAddApiKeyModal";
import { ProviderDetailEditConnectionModal } from "../../components/ProviderDetailEditConnectionModal";
import { ProviderDetailEditCompatibleNodeModal } from "../../components/ProviderDetailEditCompatibleNodeModal";
import { ProviderDetailBatchTestResultsModal } from "../../components/ProviderDetailBatchTestResultsModal";

interface ProviderDetailModalsSectionProps {
  providerId: string;
  providerInfo: any;
  showOAuthModal: boolean;
  setShowOAuthModal: (val: boolean) => void;
  handleOAuthSuccess: () => void;
  showAddApiKeyModal: boolean;
  setShowAddApiKeyModal: (val: boolean) => void;
  isCompatible: boolean;
  isAnthropicProtocolCompatible: boolean;
  isCcCompatible: boolean;
  handleSaveApiKey: (data: any) => Promise<string | null>;
  showEditModal: boolean;
  setShowEditModal: (val: boolean) => void;
  selectedConnection: any;
  handleUpdateConnection: (data: any) => Promise<string | null>;
  showEditNodeModal: boolean;
  setShowEditNodeModal: (val: boolean) => void;
  providerNode: any;
  handleUpdateNode: (data: any) => Promise<void>;
  batchTestResults: any;
  setBatchTestResults: (val: any) => void;
  t: any;
  proxyTarget: any;
  setProxyTarget: (val: any) => void;
  loadConnProxies: (conns: any[]) => Promise<void>;
  connections: any[];
}

export function ProviderDetailModalsSection({
  providerId,
  providerInfo,
  showOAuthModal,
  setShowOAuthModal,
  handleOAuthSuccess,
  showAddApiKeyModal,
  setShowAddApiKeyModal,
  isCompatible,
  isAnthropicProtocolCompatible,
  isCcCompatible,
  handleSaveApiKey,
  showEditModal,
  setShowEditModal,
  selectedConnection,
  handleUpdateConnection,
  showEditNodeModal,
  setShowEditNodeModal,
  providerNode,
  handleUpdateNode,
  batchTestResults,
  setBatchTestResults,
  t,
  proxyTarget,
  setProxyTarget,
  loadConnProxies,
  connections,
}: ProviderDetailModalsSectionProps) {
  return (
    <>
      {providerId === "kiro" ? (
        <KiroOAuthWrapper
          isOpen={showOAuthModal}
          providerInfo={providerInfo}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      ) : providerId === "cursor" ? (
        <CursorAuthModal
          isOpen={showOAuthModal}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      ) : (
        <OAuthModal
          isOpen={showOAuthModal}
          provider={providerId}
          providerInfo={providerInfo}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      )}
      <ProviderDetailAddApiKeyModal
        isOpen={showAddApiKeyModal}
        provider={providerId}
        providerName={providerInfo?.name}
        isCompatible={isCompatible}
        isAnthropic={isAnthropicProtocolCompatible}
        isCcCompatible={isCcCompatible}
        onSave={handleSaveApiKey}
        onClose={() => setShowAddApiKeyModal(false)}
      />
      <ProviderDetailEditConnectionModal
        isOpen={showEditModal}
        connection={selectedConnection}
        onSave={handleUpdateConnection}
        onClose={() => setShowEditModal(false)}
      />
      {isCompatible && (
        <ProviderDetailEditCompatibleNodeModal
          isOpen={showEditNodeModal}
          node={providerNode}
          onSave={handleUpdateNode}
          onClose={() => setShowEditNodeModal(false)}
          isAnthropic={isAnthropicProtocolCompatible}
          isCcCompatible={isCcCompatible}
        />
      )}
      <ProviderDetailBatchTestResultsModal
        batchTestResults={batchTestResults}
        providerName={providerInfo?.name || providerId}
        t={t}
        onClose={() => setBatchTestResults(null)}
      />
      {proxyTarget && (
        <ProxyConfigModal
          isOpen={!!proxyTarget}
          onClose={() => setProxyTarget(null)}
          level={proxyTarget.level}
          levelId={proxyTarget.id}
          levelLabel={proxyTarget.label}
          onSaved={() => void loadConnProxies(connections)}
        />
      )}
    </>
  );
}
