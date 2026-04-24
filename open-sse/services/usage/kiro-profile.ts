import { KIRO_CODEWHISPERER_API, KIRO_Q_API_BASE } from "./kiro-constants.ts";

/**
 * Some Kiro/Cognito access tokens embed the CodeWhisperer profile ARN in JWT claims.
 */
export function tryExtractKiroProfileArnFromAccessToken(accessToken: string): string | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const raw =
      typeof Buffer !== "undefined"
        ? Buffer.from(b64, "base64").toString("utf8")
        : typeof atob !== "undefined"
          ? atob(b64)
          : "";
    const payload = JSON.parse(raw) as Record<string, unknown>;
    for (const k of ["profileArn", "ProfileArn", "aws_profile_arn"]) {
      const v = payload[k];
      if (typeof v === "string" && v.startsWith("arn:aws:codewhisperer:")) return v.trim();
    }
    const stack: unknown[] = [payload];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== "object") continue;
      for (const v of Object.values(cur as Record<string, unknown>)) {
        if (typeof v === "string" && v.startsWith("arn:aws:codewhisperer:")) return v.trim();
        if (v && typeof v === "object") stack.push(v);
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function parseKiroListProfilesResponse(body: string): { arn: string | null } {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return { arn: null };
  }
  const profiles = (data.profiles ?? data.Profiles) as unknown;
  const list = Array.isArray(profiles) ? profiles : [];
  const first = list[0] as Record<string, unknown> | undefined;
  const arn = first?.arn ?? first?.Arn;
  if (typeof arn === "string" && arn.trim()) return { arn: arn.trim() };
  return { arn: null };
}

/**
 * Resolve profile ARN when not stored (e.g. AWS Builder ID device flow).
 * AWS exposes ListAvailableProfiles as JSON-RPC POST (x-amz-target), not GET /ListAvailableProfiles on q.*.
 */
export async function listKiroFirstProfileArn(
  accessToken: string,
  idToken?: string | null
): Promise<{
  arn: string | null;
  error?: string;
}> {
  const fromJwt =
    tryExtractKiroProfileArnFromAccessToken(accessToken) ||
    (idToken ? tryExtractKiroProfileArnFromAccessToken(idToken) : null);
  if (fromJwt) return { arn: fromJwt };

  const rpcAttempts: Array<{ url: string; target: string }> = [
    {
      url: KIRO_CODEWHISPERER_API,
      target: "AmazonCodeWhispererService.ListAvailableProfiles",
    },
    {
      url: KIRO_Q_API_BASE,
      target: "AmazonQDeveloperService.ListAvailableProfiles",
    },
  ];

  let lastDetail = "";
  let saw401 = false;
  for (const { url, target } of rpcAttempts) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-amz-json-1.0",
        "x-amz-target": target,
        Accept: "application/json",
        "x-amzn-codewhisperer-optout": "true",
      },
      body: JSON.stringify({ maxResults: 10 }),
    });

    const text = await response.text();
    if (!response.ok) {
      if (response.status === 401) saw401 = true;
      lastDetail = `${target} → HTTP ${response.status}: ${text.slice(0, 220)}`;
      continue;
    }

    const { arn } = parseKiroListProfilesResponse(text);
    if (arn) return { arn };
    lastDetail = `${target} → 200 but no profile ARN in response`;
  }

  if (saw401) {
    return {
      arn: null,
      error:
        "Kiro access token was rejected (401). Refresh the connection in Dashboard → Providers → Kiro, or sign in again.",
    };
  }

  return {
    arn: null,
    error:
      lastDetail ||
      "Could not resolve Kiro profile ARN (JWT + ListAvailableProfiles). Builder ID accounts may not expose profiles here — use Social/Import login or add profile ARN to the connection.",
  };
}
