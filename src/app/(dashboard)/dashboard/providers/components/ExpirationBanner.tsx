"use client";

import { useTranslations } from "next-intl";
import type { ExpirationBannerProps } from "../types";

export function ExpirationBanner({ expirations }: ExpirationBannerProps) {
  const t = useTranslations("providers");
  const { summary } = expirations;

  if (!summary || (summary.expired === 0 && summary.expiringSoon === 0)) {
    return null;
  }

  const hasExpired = summary.expired > 0;
  const borderColor = hasExpired ? "border-l-red-500" : "border-l-amber-500";
  const bgColor = hasExpired ? "bg-red-500/5" : "bg-amber-500/5";
  const iconBgColor = hasExpired ? "bg-red-500/15" : "bg-amber-500/15";
  const iconColor = hasExpired ? "text-red-500" : "text-amber-500";
  const titleColor = hasExpired
    ? "text-red-600 dark:text-red-400"
    : "text-amber-600 dark:text-amber-400";
  const icon = hasExpired ? "error" : "schedule";

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border border-l-[3px] ${borderColor} ${bgColor} border-red-500/10 dark:border-red-500/20`}
      role="alert"
    >
      <div
        className={`flex items-center justify-center size-8 rounded-lg ${iconBgColor} shrink-0 mt-0.5`}
      >
        <span className={`material-symbols-outlined text-[20px] ${iconColor}`} aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`font-semibold text-sm ${titleColor}`}>
          {hasExpired
            ? t("expiredCount", { count: summary.expired })
            : t("expiringSoonCount", { count: summary.expiringSoon })}
        </h3>
        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
          {hasExpired ? t("expiredAction") : t("expiringAction")}
        </p>
      </div>
    </div>
  );
}
