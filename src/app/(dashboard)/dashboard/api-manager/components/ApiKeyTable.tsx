"use client";

import { Card } from "@/shared/components";
import { useTranslations } from "next-intl";

import type { ApiKeyFull, KeyUsageStats } from "../types";
import { ApiKeyRow } from "./ApiKeyRow";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApiKeyTableProps {
  keys: ApiKeyFull[];
  usageStats: Record<string, KeyUsageStats>;
  sessionCounts: Record<string, number>;
  allowKeyReveal: boolean;
  copied: string | null;
  onOpenPermissions: (key: ApiKeyFull) => void;
  onDeleteKey: (id: string) => void;
  onCopyExistingKey: (keyId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApiKeyTable({
  keys,
  usageStats,
  sessionCounts,
  allowKeyReveal,
  copied,
  onOpenPermissions,
  onDeleteKey,
  onCopyExistingKey,
}: ApiKeyTableProps) {
  const t = useTranslations("apiManager");

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-lg bg-amber-500/10 shrink-0">
            <span className="material-symbols-outlined text-xl text-amber-500">vpn_key</span>
          </div>
          <div>
            <h3 className="font-semibold">{t("registeredKeys")}</h3>
            <p className="text-xs text-text-muted">
              {keys.length}{" "}
              {keys.length === 1
                ? t("keyRegistered", { count: keys.length })
                : t("keysRegistered", { count: keys.length })}
            </p>
          </div>
        </div>
      </div>

      <p className="text-sm text-text-muted mb-4">{t("keysSecurityNote")}</p>

      {keys.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
            <span className="material-symbols-outlined text-[32px]">vpn_key</span>
          </div>
          <p className="text-text-main font-medium mb-2">{t("noKeys")}</p>
          <p className="text-sm text-text-muted mb-4">{t("noKeysDesc")}</p>
        </div>
      ) : (
        <div className="flex flex-col border border-border rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-surface/50 border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
            <div className="col-span-2">{t("name")}</div>
            <div className="col-span-3">{t("key")}</div>
            <div className="col-span-2">{t("permissions")}</div>
            <div className="col-span-2">{t("usage")}</div>
            <div className="col-span-1">{t("created")}</div>
            <div className="col-span-2 text-right">{t("actions")}</div>
          </div>

          {/* Table Rows */}
          {keys.map((key) => (
            <ApiKeyRow
              key={key.id}
              keyData={key}
              stats={usageStats[key.id]}
              activeSessions={sessionCounts[key.id] || 0}
              allowKeyReveal={allowKeyReveal}
              copied={copied}
              onOpenPermissions={onOpenPermissions}
              onDeleteKey={onDeleteKey}
              onCopyExistingKey={onCopyExistingKey}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
