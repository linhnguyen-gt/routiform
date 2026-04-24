import { KIRO_DEFAULT_PROFILE_ARN_FALLBACK } from "./kiro-constants.ts";
import { getKiroUsageLimitsFromAws } from "./kiro-limits.ts";
import { listKiroFirstProfileArn } from "./kiro-profile.ts";

type KiroConnectionInput = {
  accessToken?: string | null;
  providerSpecificData?: Record<string, unknown> | null;
  idToken?: string | null;
};

/**
 * Kiro (AWS CodeWhisperer) Usage — GetUsageLimits needs profileArn.
 * When missing (Builder ID device flow), discover via ListAvailableProfiles (JSON-RPC POST).
 */
export async function getKiroUsage(
  accessTokenOrConnection: string | KiroConnectionInput,
  providerSpecificData?: Record<string, unknown> | null
) {
  try {
    let accessToken: string;
    let psd: Record<string, unknown> | undefined;
    let idToken: string | undefined;

    if (typeof accessTokenOrConnection === "object" && accessTokenOrConnection !== null) {
      const c = accessTokenOrConnection as KiroConnectionInput;
      accessToken = String(c.accessToken ?? "");
      psd = c.providerSpecificData ?? undefined;
      idToken = typeof c.idToken === "string" && c.idToken ? c.idToken : undefined;
    } else {
      accessToken = accessTokenOrConnection as string;
      psd = providerSpecificData ?? undefined;
    }

    let profileArn = typeof psd?.profileArn === "string" ? psd.profileArn.trim() : "";
    if (!profileArn) {
      const { arn } = await listKiroFirstProfileArn(accessToken, idToken);
      // 9router: use default profile ARN when nothing else resolves (GetUsageLimits still needs an ARN).
      profileArn = arn || KIRO_DEFAULT_PROFILE_ARN_FALLBACK;
    }

    return await getKiroUsageLimitsFromAws(accessToken, profileArn);
  } catch (error) {
    throw new Error(`Failed to fetch Kiro usage: ${(error as Error).message}`);
  }
}
