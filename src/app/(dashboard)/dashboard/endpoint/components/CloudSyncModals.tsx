"use client";

import { Modal, Button } from "@/shared/components";
import { useTranslations } from "next-intl";

interface EnableCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncing: boolean;
  modalSuccess: boolean;
  syncStep: "syncing" | "verifying" | "done" | "";
  onEnable: () => void;
}

export function EnableCloudModal({
  isOpen,
  onClose,
  syncing,
  modalSuccess,
  syncStep,
  onEnable,
}: EnableCloudModalProps) {
  const t = useTranslations("endpoint");
  const tc = useTranslations("common");

  return (
    <Modal isOpen={isOpen} title={t("enableCloudTitle")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
            {t("whatYouGet")}
          </p>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• {t("cloudBenefitAccess")}</li>
            <li>• {t("cloudBenefitShare")}</li>
            <li>• {t("cloudBenefitPorts")}</li>
            <li>• {t("cloudBenefitEdge")}</li>
          </ul>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">
            {tc("note")}
          </p>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            <li>• {t("cloudSessionNote")}</li>
            <li>• {t("cloudUnstableNote")}</li>
          </ul>
        </div>

        {(syncing || modalSuccess) && (
          <div
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
              modalSuccess
                ? "bg-green-500/10 border-green-500/30"
                : "bg-primary/10 border-primary/30"
            }`}
          >
            {modalSuccess ? (
              <span className="material-symbols-outlined text-green-500 text-xl">check_circle</span>
            ) : (
              <span className="material-symbols-outlined animate-spin text-primary">
                progress_activity
              </span>
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  modalSuccess ? "text-green-500" : "text-primary"
                }`}
              >
                {modalSuccess && t("cloudConnected")}
                {!modalSuccess && syncStep === "syncing" && t("connectingToCloud")}
                {!modalSuccess && syncStep === "verifying" && t("verifyingConnection")}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={onEnable} fullWidth disabled={syncing || modalSuccess}>
            {syncing ? (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin text-sm">
                  progress_activity
                </span>
                {syncStep === "syncing" ? t("connecting") : t("verifying")}
              </span>
            ) : modalSuccess ? (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">check</span>
                {t("connected")}
              </span>
            ) : (
              t("enableCloud")
            )}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth disabled={syncing || modalSuccess}>
            {tc("cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface DisableCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncing: boolean;
  syncStep: "syncing" | "disabling" | "";
  onConfirm: () => void;
}

export function DisableCloudModal({
  isOpen,
  onClose,
  syncing,
  syncStep,
  onConfirm,
}: DisableCloudModalProps) {
  const t = useTranslations("endpoint");
  const tc = useTranslations("common");

  return (
    <Modal isOpen={isOpen} title={t("disableCloudTitle")} onClose={() => !syncing && onClose()}>
      <div className="flex flex-col gap-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-red-600 dark:text-red-400">
              warning
            </span>
            <div>
              <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-1">
                {tc("warning")}
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">{t("disableWarning")}</p>
            </div>
          </div>
        </div>

        {syncing && (
          <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
            <span className="material-symbols-outlined animate-spin text-primary">
              progress_activity
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-primary">
                {syncStep === "syncing" && t("syncingData")}
                {syncStep === "disabling" && t("disablingCloud")}
              </p>
            </div>
          </div>
        )}

        <p className="text-sm text-text-muted">{t("disableConfirm")}</p>

        <div className="flex gap-2">
          <Button
            onClick={onConfirm}
            fullWidth
            disabled={syncing}
            className="bg-red-500! hover:bg-red-600! text-white!"
          >
            {syncing ? (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin text-sm">
                  progress_activity
                </span>
                {syncStep === "syncing" ? t("syncing") : t("disabling")}
              </span>
            ) : (
              t("disableCloud")
            )}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth disabled={syncing}>
            {tc("cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
