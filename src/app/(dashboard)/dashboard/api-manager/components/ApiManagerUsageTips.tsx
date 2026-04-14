"use client";

import { Card } from "@/shared/components";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApiManagerUsageTips() {
  const t = useTranslations("apiManager");

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10 shrink-0">
          <span className="material-symbols-outlined text-xl text-blue-500">lightbulb</span>
        </div>
        <div>
          <h3 className="font-semibold mb-2">{t("usageTips")}</h3>
          <ul className="text-sm text-text-muted space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-xs text-primary mt-1">check</span>
              <span>{t("tipAuth")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-xs text-primary mt-1">check</span>
              <span>{t("tipSecure")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-xs text-primary mt-1">check</span>
              <span>{t("tipSeparate")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-xs text-primary mt-1">check</span>
              <span>{t("tipRestrict")}</span>
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
