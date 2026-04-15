"use client";

import { useCallback } from "react";

import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKeyActions() {
  const { copied, copy } = useCopyToClipboard();

  /** Reveal an existing key from the server and copy it to clipboard. */
  const copyExistingKey = useCallback(
    async (keyId: string): Promise<boolean> => {
      if (!keyId) return false;

      try {
        const res = await fetch(`/api/keys/${encodeURIComponent(keyId)}/reveal`);
        if (!res.ok) {
          console.log("Error revealing key:", await res.text());
          return false;
        }

        const data = await res.json();
        if (typeof data?.key === "string") {
          await copy(data.key, `existing_key_${keyId}`);
          return true;
        }
        return false;
      } catch (err) {
        console.log("Error copying existing key:", err);
        return false;
      }
    },
    [copy]
  );

  return {
    copied,
    copy,
    copyExistingKey,
  };
}
