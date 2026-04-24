"use client";

import { useState, useEffect } from "react";
import { Card } from "@/shared/components";
import { useTranslations } from "next-intl";

type ContextValidationMode = "passthrough" | "auto-compress";

export default function ContextValidationTab() {
  const t = useTranslations("settings");
  const [mode, setMode] = useState<ContextValidationMode>("passthrough");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"" | "saved" | "error">("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (
          data?.contextValidation === "auto-compress" ||
          data?.contextValidation === "passthrough"
        ) {
          setMode(data.contextValidation);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (next: ContextValidationMode) => {
    setMode(next);
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextValidation: next }),
      });
      if (res.ok) {
        setStatus("saved");
        setTimeout(() => setStatus(""), 2000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            compress
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold">{t("contextValidationTitle")}</h3>
          <p className="text-sm text-text-muted">{t("contextValidationDesc")}</p>
        </div>
        {status === "saved" && (
          <span className="ml-auto text-xs font-medium text-emerald-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span> {t("saved")}
          </span>
        )}
        {status === "error" && (
          <span className="ml-auto text-xs font-medium text-red-500">{t("errorOccurred")}</span>
        )}
      </div>

      <p className="text-xs text-text-muted mb-4">{t("contextValidationEnvOverride")}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => save("passthrough")}
          disabled={loading || saving}
          className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
            mode === "passthrough"
              ? "border-sky-500/50 bg-sky-500/5 ring-1 ring-sky-500/20"
              : "border-border/50 hover:border-border hover:bg-surface/30"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[20px] mt-0.5 ${
              mode === "passthrough" ? "text-sky-600 dark:text-sky-400" : "text-text-muted"
            }`}
            aria-hidden
          >
            unfold_more
          </span>
          <span>
            <span className="block text-sm font-medium text-text-main">
              {t("contextValidationPassthrough")}
            </span>
            <span className="block text-xs text-text-muted mt-1">
              {t("contextValidationPassthroughDesc")}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => save("auto-compress")}
          disabled={loading || saving}
          className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
            mode === "auto-compress"
              ? "border-sky-500/50 bg-sky-500/5 ring-1 ring-sky-500/20"
              : "border-border/50 hover:border-border hover:bg-surface/30"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[20px] mt-0.5 ${
              mode === "auto-compress" ? "text-sky-600 dark:text-sky-400" : "text-text-muted"
            }`}
            aria-hidden
          >
            auto_fix_high
          </span>
          <span>
            <span className="block text-sm font-medium text-text-main">
              {t("contextValidationAutoCompress")}
            </span>
            <span className="block text-xs text-text-muted mt-1">
              {t("contextValidationAutoCompressDesc")}
            </span>
          </span>
        </button>
      </div>
    </Card>
  );
}
