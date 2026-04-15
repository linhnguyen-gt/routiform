import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Modal, Input, Button, Badge } from "@/shared/components";
import {
  CC_COMPATIBLE_LABEL,
  ADD_CC_COMPATIBLE_LABEL,
  CC_COMPATIBLE_DEFAULT_CHAT_PATH,
} from "../provider-page-helpers.tsx";
import type { AddModalProps } from "../types";

export function AddCcCompatibleModal({ isOpen, onClose, onCreated }: AddModalProps) {
  const t = useTranslations("providers");
  const [formData, setFormData] = useState({
    name: "",
    prefix: "",
    baseUrl: "https://api.anthropic.com",
    chatPath: CC_COMPATIBLE_DEFAULT_CHAT_PATH,
  });
  const [submitting, setSubmitting] = useState(false);
  const [checkKey, setCheckKey] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<"success" | "failed" | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValidationResult(null);
      setCheckKey("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.prefix.trim() || !formData.baseUrl.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/provider-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          prefix: formData.prefix,
          baseUrl: formData.baseUrl,
          type: "anthropic-compatible",
          compatMode: "cc",
          chatPath: formData.chatPath || CC_COMPATIBLE_DEFAULT_CHAT_PATH,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onCreated(data.node);
        setFormData({
          name: "",
          prefix: "",
          baseUrl: "https://api.anthropic.com",
          chatPath: CC_COMPATIBLE_DEFAULT_CHAT_PATH,
        });
        setCheckKey("");
        setValidationResult(null);
        setShowAdvanced(false);
      }
    } catch (error) {
      console.log("Error creating CC Compatible node:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch("/api/provider-nodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: formData.baseUrl,
          apiKey: checkKey,
          type: "anthropic-compatible",
          compatMode: "cc",
          chatPath: formData.chatPath || CC_COMPATIBLE_DEFAULT_CHAT_PATH,
        }),
      });
      const data = await res.json();
      setValidationResult(data.valid ? "success" : "failed");
    } catch {
      setValidationResult("failed");
    } finally {
      setValidating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} title={ADD_CC_COMPATIBLE_LABEL} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input
          label={t("nameLabel")}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={t("compatibleProdPlaceholder", { type: CC_COMPATIBLE_LABEL })}
          hint={t("nameHint")}
        />
        <Input
          label={t("prefixLabel")}
          value={formData.prefix}
          onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
          placeholder="cc-prod"
          hint={t("prefixHint")}
        />
        <Input
          label={t("baseUrlLabel")}
          value={formData.baseUrl}
          onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
          placeholder="https://api.anthropic.com"
          hint={t("compatibleBaseUrlHint", { type: CC_COMPATIBLE_LABEL })}
        />
        <button
          type="button"
          className="text-sm text-text-muted hover:text-text-primary flex items-center gap-1"
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-expanded={showAdvanced}
          aria-controls="advanced-settings-cc"
        >
          <span
            className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}
            aria-hidden="true"
          >
            ▶
          </span>
          {t("advancedSettings")}
        </button>
        {showAdvanced && (
          <div
            id="advanced-settings-cc"
            className="flex flex-col gap-3 pl-2 border-l-2 border-border"
          >
            <Input
              label={t("chatPathLabel")}
              value={formData.chatPath}
              onChange={(e) => setFormData({ ...formData, chatPath: e.target.value })}
              placeholder={CC_COMPATIBLE_DEFAULT_CHAT_PATH}
              hint={t("chatPathHint")}
            />
          </div>
        )}
        <div className="flex gap-2">
          <Input
            label={t("apiKeyForCheck")}
            type="password"
            value={checkKey}
            onChange={(e) => setCheckKey(e.target.value)}
            className="flex-1"
          />
          <div className="pt-6">
            <Button
              onClick={handleValidate}
              disabled={!checkKey || validating || !formData.baseUrl.trim()}
              variant="secondary"
            >
              {validating ? t("checking") : t("check")}
            </Button>
          </div>
        </div>
        {validationResult && (
          <Badge variant={validationResult === "success" ? "success" : "error"}>
            {validationResult === "success" ? t("valid") : t("invalid")}
          </Badge>
        )}
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            fullWidth
            disabled={
              !formData.name.trim() ||
              !formData.prefix.trim() ||
              !formData.baseUrl.trim() ||
              submitting
            }
          >
            {submitting ? t("creating") : t("add")}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
