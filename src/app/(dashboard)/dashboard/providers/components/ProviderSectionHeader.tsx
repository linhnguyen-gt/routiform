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
  testingMode?: string | null;
  testModeKey?: string;
  onTestAll?: () => void;
  testAllLabel?: string;
  testAllAriaLabel?: string;
  actions?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProviderSectionHeader({
  title,
  authType,
  dotColor,
  dotLabel,
  showConfiguredOnly,
  onToggleConfiguredOnly,
  showConfiguredToggle = false,
  showModelAvailability = false,
  testingMode,
  testModeKey,
  onTestAll,
  testAllLabel,
  testAllAriaLabel,
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

        {onTestAll && testModeKey && (
          <button
            onClick={onTestAll}
            disabled={!!testingMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer ${
              testingMode === testModeKey
                ? "bg-primary/15 border-primary/30 text-primary animate-pulse"
                : "bg-bg-subtle border-border text-text-muted hover:text-text-primary hover:border-primary/30"
            }`}
            title={testAllAriaLabel}
            aria-label={testAllAriaLabel}
          >
            <span
              className={`material-symbols-outlined text-[14px] ${
                testingMode === testModeKey ? "animate-spin" : ""
              }`}
              aria-hidden="true"
            >
              {testingMode === testModeKey ? "sync" : "play_arrow"}
            </span>
            {testingMode === testModeKey ? t("testing") : testAllLabel}
          </button>
        )}

        {actions}
      </div>
    </div>
  );
}
