"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Modal from "./Modal";
import Button from "./Button";

/**
 * Devin Auth Modal
 * Import token from Devin CLI's local credential storage.
 * Users authenticate via `devin auth login` and we import the stored token.
 */
export default function DevinAuthModal({ isOpen, onSuccess, onClose }) {
  const tc = useTranslations("common");
  const [accessToken, setAccessToken] = useState("");
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
        const res = await fetch("/api/oauth/devin/auto-import");
        const data = await res.json();

        if (data.found) {
          setAccessToken(data.accessToken);
          setAutoDetected(true);
        } else {
          setError(
            data.error ||
              "Could not auto-detect Devin credentials. Please paste your token manually."
          );
        }
      } catch (_err) {
        setError(
          "Failed to detect Devin credentials. Ensure Devin CLI is installed and authenticated."
        );
      } finally {
        setAutoDetecting(false);
      }
    };

    autoDetect();
  }, [isOpen]);

  const handleImportToken = async () => {
    if (!accessToken.trim()) {
      setError("Please enter your Devin access token.");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/devin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: accessToken.trim(),
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
    <Modal isOpen={isOpen} title="Connect Devin" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Auto-detecting state */}
        {autoDetecting && (
          <div className="text-center py-6">
            <div className="size-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-primary animate-spin">
                progress_activity
              </span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Detecting Devin CLI credentials...</h3>
            <p className="text-sm text-text-muted">Reading from Devin CLI local storage</p>
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
                    Devin credentials detected automatically.
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
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p>
                      Run{" "}
                      <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
                        devin auth login
                      </code>{" "}
                      first, then paste your token below.
                    </p>
                    <p className="mt-1 text-xs opacity-75">
                      Check status with:{" "}
                      <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
                        devin auth status
                      </code>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Access Token Input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Access Token <span className="text-red-500">*</span>
              </label>
              <textarea
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Paste your Devin access token here..."
                rows={3}
                className="w-full px-3 py-2 text-sm font-mono border border-border rounded-lg bg-background focus:outline-none focus:border-primary resize-none"
              />
              <p className="text-xs text-text-muted mt-1">
                Token is stored in ~/.local/share/devin/ after running devin auth login
              </p>
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
                disabled={importing || !accessToken.trim()}
              >
                {importing ? "Importing..." : "Import Token"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
