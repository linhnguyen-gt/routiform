"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import PropTypes from "prop-types";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";

/**
 * Cursor Auth Modal
 * Auto-detect and import token from Cursor IDE's local SQLite database
 */
export default function CursorAuthModal({ isOpen, onSuccess, onClose }) {
  const t = useTranslations("modals");
  const tc = useTranslations("common");
  const [accessToken, setAccessToken] = useState("");
  const [machineId, setMachineId] = useState("");
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  // Auto-detect tokens when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const autoDetect = async () => {
      setAutoDetecting(true);
      setError(null);
      setAutoDetected(false);

      try {
        const res = await fetch("/api/oauth/cursor/auto-import");
        const data = await res.json();

        if (data.found) {
          setAccessToken(data.accessToken);
          setMachineId(data.machineId);
          setAutoDetected(true);
        } else {
          setError(data.error || t("cursorCouldNotDetect"));
        }
      } catch (_err) {
        setError(t("cursorFailedDetect"));
      } finally {
        setAutoDetecting(false);
      }
    };

    autoDetect();
  }, [isOpen, t]);

  const handleImportToken = async () => {
    if (!accessToken.trim()) {
      setError(t("cursorEnterAccessToken"));
      return;
    }

    if (!machineId.trim()) {
      setError(t("cursorEnterMachineId"));
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/cursor/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: accessToken.trim(),
          machineId: machineId.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      // Success - close modal and trigger refresh
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} title={t("cursorConnectTitle")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Auto-detecting state */}
        {autoDetecting && (
          <div className="text-center py-6">
            <div className="size-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-primary animate-spin">
                progress_activity
              </span>
            </div>
            <h3 className="text-lg font-semibold mb-2">{t("cursorAutoDetecting")}</h3>
            <p className="text-sm text-text-muted">{t("cursorReadingDb")}</p>
          </div>
        )}

        {/* Form (shown after auto-detect completes) */}
        {!autoDetecting && (
          <>
            {/* Success message if auto-detected */}
            {autoDetected && (
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex gap-2">
                  <span className="material-symbols-outlined text-green-600 dark:text-green-400">
                    check_circle
                  </span>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    {t("cursorAutoDetectSuccess")}
                  </p>
                </div>
              </div>
            )}

            {/* Info message if not auto-detected */}
            {!autoDetected && !error && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex gap-2">
                  <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">
                    info
                  </span>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {t("cursorNotDetected")}
                  </p>
                </div>
              </div>
            )}

            {/* Access Token Input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("cursorAccessToken")} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={t("cursorAccessTokenPlaceholder")}
                rows={3}
                className="w-full px-3 py-2 text-sm font-mono border border-border rounded-lg bg-background focus:outline-none focus:border-primary resize-none"
              />
            </div>

            {/* Machine ID Input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t("cursorMachineId")} <span className="text-red-500">*</span>
              </label>
              <Input
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                placeholder={t("cursorMachineIdPlaceholder")}
                className="font-mono text-sm"
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button onClick={onClose} variant="ghost" fullWidth>
                {tc("cancel")}
              </Button>
              <Button
                onClick={handleImportToken}
                fullWidth
                disabled={importing || !accessToken.trim() || !machineId.trim()}
              >
                {importing ? t("cursorImporting") : t("cursorImportToken")}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

CursorAuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};
