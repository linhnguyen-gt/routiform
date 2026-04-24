// ── Gemini CLI subscription info cache ──────────────────────────────────────
// Prevents duplicate loadCodeAssist calls within the same quota cycle.
// Key: accessToken → { data, fetchedAt }
const _geminiCliSubCache = new Map();
const GEMINI_CLI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get Gemini CLI subscription info (cached, 5 min TTL)
 */
export async function getGeminiCliSubscriptionInfoCached(accessToken) {
  const cacheKey = accessToken;
  const cached = _geminiCliSubCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < GEMINI_CLI_CACHE_TTL_MS) {
    return cached.data;
  }

  const data = await getGeminiCliSubscriptionInfo(accessToken);
  _geminiCliSubCache.set(cacheKey, { data, fetchedAt: Date.now() });
  return data;
}

/**
 * Get Gemini CLI subscription info using correct headers.
 */
async function getGeminiCliSubscriptionInfo(accessToken) {
  try {
    const response = await fetch("https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        metadata: {
          ideType: "IDE_UNSPECIFIED",
          platform: "PLATFORM_UNSPECIFIED",
          pluginType: "GEMINI",
        },
      }),
    });

    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}
