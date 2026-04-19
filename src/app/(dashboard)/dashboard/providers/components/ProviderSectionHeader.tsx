"use client";

import { useTranslations } from "next-intl";
import ModelAvailabilityBadge from "./ModelAvailabilityBadge";
import { Toggle } from "@/shared/components";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProviderSectionHeaderProps {
  title: string;
  authType: "oauth" | "apikey" | "compatible";
  dotColor: string;
  dotLabel: string;
  showConfiguredOnly: boolean;
  onToggleConfiguredOnly: (value: boolean) => void;
  showConfiguredToggle?: boolean;
  showModelAvailability?: boolean;
  actions?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProviderSectionHeader({
  title,
  authType: _authType,
  dotColor,
  dotLabel,
  showConfiguredOnly,
  onToggleConfiguredOnly,
  showConfiguredToggle = false,
  showModelAvailability = false,
  actions,
}: ProviderSectionHeaderProps) {
  const t = useTranslations("providers");

  return (
    <div className="flex flex-wrap items-center gap-3 py-1">
      {/* Title with auth-type indicator dot */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={`size-2.5 rounded-full ${dotColor} shrink-0`} title={dotLabel} />
        <h2 className="text-lg font-semibold text-text-main">{title}</h2>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {showModelAvailability && <ModelAvailabilityBadge />}

        {showConfiguredToggle && (
          <Toggle
            size="sm"
            checked={showConfiguredOnly}
            onChange={onToggleConfiguredOnly}
            label={t("showConfiguredOnly")}
            className="rounded-lg border border-border bg-bg-subtle px-3 py-1.5"
          />
        )}

        {actions}
      </div>
    </div>
  );
}
