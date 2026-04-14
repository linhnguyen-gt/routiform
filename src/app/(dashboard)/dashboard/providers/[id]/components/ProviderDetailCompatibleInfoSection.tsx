"use client";

import { Card, Button } from "@/shared/components";
import {
  CC_COMPATIBLE_DEFAULT_CHAT_PATH,
  CC_COMPATIBLE_DETAILS_TITLE,
  CC_COMPATIBLE_LABEL,
} from "../../providerDetailCompatUtils";

interface ProviderDetailCompatibleInfoSectionProps {
  t: any;
  isCcCompatible: boolean;
  isAnthropicCompatible: boolean;
  isCompatible: boolean;
  providerNode: any;
  providerId: string;
  isAnthropicProtocolCompatible: boolean;
  connections: any[];
  setShowAddApiKeyModal: (val: boolean) => void;
  setShowEditNodeModal: (val: boolean) => void;
  router: any;
}

export function ProviderDetailCompatibleInfoSection({
  t,
  isCcCompatible,
  isAnthropicCompatible,
  isCompatible,
  providerNode,
  providerId,
  isAnthropicProtocolCompatible,
  connections,
  setShowAddApiKeyModal,
  setShowEditNodeModal,
  router,
}: ProviderDetailCompatibleInfoSectionProps) {
  if (!isCompatible || !providerNode) return null;

  return (
    <Card className="rounded-xl border-border/50 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">
            {isCcCompatible
              ? CC_COMPATIBLE_DETAILS_TITLE
              : isAnthropicCompatible
                ? t("anthropicCompatibleDetails")
                : t("openaiCompatibleDetails")}
          </h2>
          <p className="text-sm text-text-muted">
            {isAnthropicProtocolCompatible
              ? t("messagesApi")
              : providerNode.apiType === "responses"
                ? t("responsesApi")
                : t("chatCompletions")}{" "}
            · {(providerNode.baseUrl || "").replace(/\/$/, "")}/
            {isCcCompatible
              ? (providerNode.chatPath || CC_COMPATIBLE_DEFAULT_CHAT_PATH).replace(/^\//, "")
              : isAnthropicCompatible
                ? (providerNode.chatPath || "/messages").replace(/^\//, "")
                : providerNode.apiType === "responses"
                  ? (providerNode.chatPath || "/responses").replace(/^\//, "")
                  : (providerNode.chatPath || "/chat/completions").replace(/^\//, "")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            icon="add"
            onClick={() => setShowAddApiKeyModal(true)}
            disabled={connections.length > 0}
          >
            {t("add")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon="edit"
            onClick={() => setShowEditNodeModal(true)}
          >
            {t("edit")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon="delete"
            onClick={async () => {
              if (
                !confirm(
                  t("deleteCompatibleNodeConfirm", {
                    type: isCcCompatible
                      ? CC_COMPATIBLE_LABEL
                      : isAnthropicCompatible
                        ? t("anthropic")
                        : t("openai"),
                  })
                )
              )
                return;
              try {
                const res = await fetch(`/api/provider-nodes/${providerId}`, { method: "DELETE" });
                if (res.ok) router.push("/dashboard/providers");
              } catch (error) {
                console.log("Error deleting provider node:", error);
              }
            }}
          >
            {t("delete")}
          </Button>
        </div>
      </div>
      {connections.length > 0 && (
        <p className="text-sm text-text-muted">{t("singleConnectionPerCompatible")}</p>
      )}
    </Card>
  );
}
