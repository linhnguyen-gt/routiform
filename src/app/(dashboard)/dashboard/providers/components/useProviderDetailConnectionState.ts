"use client";

import { useEffect, useState } from "react";

import { normalizeCodexLimitPolicy } from "../providerDetailCompatViewUtils";
import { getStatusPresentation } from "../providerDetailErrorUtils";
import type { ConnectionRowConnection } from "../[id]/types";

type Translator = (key: string, values?: unknown) => string;

export function useProviderDetailConnectionState(
  connection: ConnectionRowConnection,
  isOAuth: boolean,
  t: Translator
) {
  const [isCooldown, setIsCooldown] = useState(false);
  const effectiveExpiresAt = connection.tokenExpiresAt || connection.expiresAt;
  const [tokenMinsLeft, setTokenMinsLeft] = useState<number | null>(() => {
    if (!isOAuth || !effectiveExpiresAt) return null;
    return Math.floor((new Date(effectiveExpiresAt).getTime() - Date.now()) / 60000);
  });

  useEffect(() => {
    if (!isOAuth || !effectiveExpiresAt) return;
    const update = () => {
      const expiresMs = new Date(effectiveExpiresAt).getTime();
      setTokenMinsLeft(Math.floor((expiresMs - Date.now()) / 60000));
    };
    update();
    const intervalId = setInterval(update, 30000);
    return () => clearInterval(intervalId);
  }, [effectiveExpiresAt, isOAuth]);

  useEffect(() => {
    const checkCooldown = () => {
      const cooldown =
        connection.rateLimitedUntil && new Date(connection.rateLimitedUntil).getTime() > Date.now();
      setIsCooldown(Boolean(cooldown));
    };
    checkCooldown();
    const intervalId = connection.rateLimitedUntil ? setInterval(checkCooldown, 1000) : null;
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [connection.rateLimitedUntil]);

  const effectiveStatus =
    connection.testStatus === "unavailable" && !isCooldown ? "active" : connection.testStatus;
  const statusPresentation = getStatusPresentation(
    connection,
    effectiveStatus || "",
    isCooldown,
    t
  );
  const rateLimitEnabled = !!connection.rateLimitProtection;
  const rawPolicy =
    connection.providerSpecificData &&
    typeof connection.providerSpecificData === "object" &&
    connection.providerSpecificData.codexLimitPolicy &&
    typeof connection.providerSpecificData.codexLimitPolicy === "object"
      ? connection.providerSpecificData.codexLimitPolicy
      : {};
  const codexPolicy = normalizeCodexLimitPolicy(rawPolicy);

  return {
    codex5hEnabled: codexPolicy.use5h,
    codexWeeklyEnabled: codexPolicy.useWeekly,
    effectiveExpiresAt,
    isCooldown,
    rateLimitEnabled,
    statusPresentation,
    tokenMinsLeft,
  };
}
