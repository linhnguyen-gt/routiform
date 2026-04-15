import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Card, Badge, Toggle } from "@/shared/components";
import ProviderIcon from "@/shared/components/ProviderIcon";
import {
  isAnthropicCompatibleProvider,
  isClaudeCodeCompatibleProvider,
  isOpenAICompatibleProvider,
} from "@/shared/constants/providers";
import { getStatusDisplay } from "../provider-page-helpers.tsx";
import type { ApiKeyProviderCardProps } from "../types";

/** Maps auth type to a left-border accent color */
const authTypeBorderColors: Record<string, string> = {
  free: "border-l-green-500",
  oauth: "border-l-blue-500",
  apikey: "border-l-amber-500",
  compatible: "border-l-orange-500",
};

const authTypeDotColors: Record<string, string> = {
  free: "bg-green-500",
  oauth: "bg-blue-500",
  apikey: "bg-amber-500",
  compatible: "bg-orange-500",
};

export function ApiKeyProviderCard({
  providerId,
  provider,
  stats,
  authType,
  onToggle,
}: ApiKeyProviderCardProps) {
  const t = useTranslations("providers");
  const tc = useTranslations("common");
  const { connected, error, errorCode, errorTime, allDisabled } = stats;
  const isCompatible = isOpenAICompatibleProvider(providerId);
  const isCcCompatible = isClaudeCodeCompatibleProvider(providerId);
  const isAnthropicCompatible =
    isAnthropicCompatibleProvider(providerId) && !isClaudeCodeCompatibleProvider(providerId);

  const borderColor = authTypeBorderColors[authType] || authTypeBorderColors.apikey;

  // For compatible/anthropic providers, use static PNGs via the icon path
  const staticIconPath = (() => {
    if (isCompatible) {
      return provider.apiType === "responses" ? "/providers/oai-r.png" : "/providers/oai-cc.png";
    }
    if (isAnthropicCompatible || isCcCompatible) return "/providers/anthropic-m.png";
    return null;
  })();

  return (
    <Link href={`/dashboard/providers/${providerId}`} className="group">
      <Card
        padding="xs"
        className={`h-full border-l-[3px] ${borderColor} hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all duration-200 cursor-pointer ${
          allDisabled ? "opacity-50" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="size-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${provider.color}12` }}
            >
              {staticIconPath ? (
                <Image
                  src={staticIconPath}
                  alt={provider.name}
                  width={24}
                  height={24}
                  className="object-contain rounded"
                  sizes="24px"
                />
              ) : (
                <ProviderIcon providerId={provider.id} size={24} type="color" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate flex items-center gap-1.5">
                {provider.name}
                <span
                  className={`size-2 rounded-full ${authTypeDotColors[authType] || authTypeDotColors.apikey} shrink-0`}
                  title={authType === "compatible" ? t("compatibleLabel") : t("apiKeyLabel")}
                />
              </h3>
              <div className="flex items-center gap-1.5 text-xs flex-wrap mt-0.5">
                {allDisabled ? (
                  <Badge variant="default" size="sm">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                        pause_circle
                      </span>
                      {t("disabled")}
                    </span>
                  </Badge>
                ) : (
                  <>
                    {getStatusDisplay(connected, error, stats.warning, errorCode, t, tc)}
                    {stats.expiryStatus === "expired" && (
                      <Badge variant="error" size="sm" dot>
                        Expired
                      </Badge>
                    )}
                    {stats.expiryStatus === "expiring_soon" && (
                      <Badge variant="warning" size="sm" dot>
                        Expiring Soon
                      </Badge>
                    )}
                    {isCompatible && (
                      <Badge variant="default" size="sm">
                        {provider.apiType === "responses" ? t("responses") : t("chat")}
                      </Badge>
                    )}
                    {isCcCompatible && (
                      <Badge variant="default" size="sm">
                        CC
                      </Badge>
                    )}
                    {isAnthropicCompatible && (
                      <Badge variant="default" size="sm">
                        {t("messages")}
                      </Badge>
                    )}
                    {errorTime && <span className="text-text-muted">· {errorTime}</span>}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {stats.total > 0 && (
              <div
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle(!allDisabled ? false : true);
                }}
                role="switch"
                aria-checked={!allDisabled}
                aria-label={allDisabled ? t("enableProvider") : t("disableProvider")}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggle(!allDisabled ? false : true);
                  }
                }}
              >
                <Toggle
                  size="sm"
                  checked={!allDisabled}
                  onChange={() => {}}
                  title={allDisabled ? t("enableProvider") : t("disableProvider")}
                />
              </div>
            )}
            <span
              className="material-symbols-outlined text-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              aria-hidden="true"
            >
              chevron_right
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
