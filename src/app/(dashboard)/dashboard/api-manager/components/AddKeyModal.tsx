"use client";

import { Button, Input, Modal } from "@/shared/components";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddKeyModalProps {
  isOpen: boolean;
  newKeyName: string;
  onKeyNameChange: (name: string) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddKeyModal({
  isOpen,
  newKeyName,
  onKeyNameChange,
  isSubmitting,
  onClose,
  onCreate,
}: AddKeyModalProps) {
  const t = useTranslations("apiManager");
  const tc = useTranslations("common");

  return (
    <Modal
      isOpen={isOpen}
      title={t("createKey")}
      onClose={() => {
        onClose();
      }}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-text-main mb-1.5 block">{t("keyName")}</label>
          <Input
            value={newKeyName}
            onChange={(e) => onKeyNameChange(e.target.value)}
            placeholder={t("keyNamePlaceholder")}
            autoFocus
          />
          <p className="text-xs text-text-muted mt-1.5">{t("keyNameDesc")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onClose} variant="ghost" fullWidth>
            {tc("cancel")}
          </Button>
          <Button onClick={onCreate} fullWidth disabled={!newKeyName.trim() || isSubmitting}>
            {t("createKey")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
