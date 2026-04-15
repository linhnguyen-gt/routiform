"use client";

import { Button, Input, Modal } from "@/shared/components";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreatedKeyModalProps {
  createdKey: string | null;
  copied: string | null;
  onCopy: (text: string, id?: string) => Promise<boolean>;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreatedKeyModal({ createdKey, copied, onCopy, onClose }: CreatedKeyModalProps) {
  const t = useTranslations("apiManager");
  const tc = useTranslations("common");

  return (
    <Modal isOpen={!!createdKey} title={t("keyCreated")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-green-600 dark:text-green-400">
              check_circle
            </span>
            <div>
              <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-1">
                {t("keyCreatedSuccess")}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">{t("keyCreatedNote")}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Input value={createdKey || ""} readOnly className="flex-1 font-mono text-sm" />
          <Button
            variant="secondary"
            icon={copied === "created_key" ? "check" : "content_copy"}
            onClick={() => onCopy(createdKey!, "created_key")}
          >
            {copied === "created_key" ? tc("copied") : tc("copy")}
          </Button>
        </div>
        <Button onClick={onClose} fullWidth>
          {t("done")}
        </Button>
      </div>
    </Modal>
  );
}
