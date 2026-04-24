import {
  GITHUB_CHAT_COMPLETIONS_MIN_RATIO,
  GITHUB_REMAINING_FRAC_EPS,
} from "./github-constants.ts";
import { formatGitHubQuotaSnapshot } from "./github-format-snapshot.ts";
import { getFieldValue, toNumber } from "./json-helpers.ts";
import type { UsageQuota } from "./types.ts";

export function shouldDisplayGitHubQuota(quota: UsageQuota | null): quota is UsageQuota {
  if (!quota) return false;
  if (quota.unlimited && quota.total <= 0 && quota.remainingPercentage === undefined) {
    return false;
  }
  return quota.total > 0 || quota.remainingPercentage !== undefined;
}

/** Remaining fraction 0..1; bare unlimited (no counts) = 1 so paired capped bucket sorts as Chat. */
function githubQuotaRemainingFraction(q: UsageQuota | null): number | null {
  if (!q) return null;
  if (q.unlimited === true && q.total <= 0) {
    return 1;
  }
  if (q.total <= 0) {
    return q.unlimited ? 1 : null;
  }
  const rem =
    q.remaining !== undefined && q.remaining !== null
      ? Math.max(0, q.remaining)
      : Math.max(0, q.total - q.used);
  return Math.min(1, rem / q.total);
}

/**
 * Map snapshot keys → UI "Chat" / "Completions". GitHub often swaps keys: Copilot **Chat messages**
 * tend to run out before IDE **completions**, so the bucket with **lower** remaining fraction is
 * Chat; the **higher** is Completions. Tie → smaller entitlement = Chat (typical Free tier).
 */
export function resolveGitHubChatCompletionsQuotas(
  snapshots: Record<string, unknown>,
  resetAt: string | null
): { chat: UsageQuota | null; completions: UsageQuota | null } {
  const chatQ = formatGitHubQuotaSnapshot(snapshots.chat, resetAt);
  const compQ = formatGitHubQuotaSnapshot(snapshots.completions, resetAt);

  if (!chatQ && !compQ) return { chat: null, completions: null };
  if (!chatQ) return { chat: null, completions: compQ };
  if (!compQ) return { chat: chatQ, completions: null };

  const fChat = githubQuotaRemainingFraction(chatQ);
  const fComp = githubQuotaRemainingFraction(compQ);
  if (fChat === null || fComp === null) {
    return { chat: chatQ, completions: compQ };
  }

  if (fChat + GITHUB_REMAINING_FRAC_EPS < fComp) {
    return { chat: chatQ, completions: compQ };
  }
  if (fComp + GITHUB_REMAINING_FRAC_EPS < fChat) {
    return { chat: compQ, completions: chatQ };
  }

  const chatCap = !chatQ.unlimited && chatQ.total > 0;
  const compCap = !compQ.unlimited && compQ.total > 0;
  if (chatQ.unlimited === true && !compQ.unlimited && compCap) {
    return { chat: compQ, completions: chatQ };
  }
  if (!chatQ.unlimited && compQ.unlimited === true && chatCap) {
    return { chat: chatQ, completions: compQ };
  }

  if (chatCap && compCap) {
    const minT = Math.min(chatQ.total, compQ.total);
    const maxT = Math.max(chatQ.total, compQ.total);
    if (minT > 0 && maxT >= minT * GITHUB_CHAT_COMPLETIONS_MIN_RATIO) {
      return chatQ.total <= compQ.total
        ? { chat: chatQ, completions: compQ }
        : { chat: compQ, completions: chatQ };
    }
  }

  return { chat: chatQ, completions: compQ };
}

/**
 * Bare unlimited bucket (no entitlement) should still show ~100% remaining when the paired bucket
 * has counts. If both are bare-unlimited (Business), leave unset so both stay hidden.
 */
export function patchGitHubUnlimitedPairForUi(quotas: Record<string, UsageQuota>): void {
  const chat = quotas.chat;
  const comp = quotas.completions;
  if (!chat || !comp) return;

  const chatBare =
    chat.unlimited === true && chat.total <= 0 && chat.remainingPercentage === undefined;
  const compBare =
    comp.unlimited === true && comp.total <= 0 && comp.remainingPercentage === undefined;

  if (chatBare && !compBare) {
    chat.remainingPercentage = 100;
  } else if (!chatBare && compBare) {
    comp.remainingPercentage = 100;
  }
}

export function resolveGitHubMonthlyChatCompletions(
  monthlyQuotas: Record<string, unknown>,
  usedQuotas: Record<string, unknown>
): { monthly: Record<string, unknown>; used: Record<string, unknown> } {
  const ct = toNumber(getFieldValue(monthlyQuotas, "chat", "chat"), 0);
  const cpt = toNumber(getFieldValue(monthlyQuotas, "completions", "completions"), 0);
  const cu = Math.max(0, toNumber(getFieldValue(usedQuotas, "chat", "chat"), 0));
  const cpu = Math.max(0, toNumber(getFieldValue(usedQuotas, "completions", "completions"), 0));
  if (!(ct > 0 && cpt > 0)) {
    return { monthly: monthlyQuotas, used: usedQuotas };
  }

  const remChat = (ct - Math.min(cu, ct)) / ct;
  const remComp = (cpt - Math.min(cpu, cpt)) / cpt;

  if (remChat + GITHUB_REMAINING_FRAC_EPS < remComp) {
    return { monthly: monthlyQuotas, used: usedQuotas };
  }
  if (remComp + GITHUB_REMAINING_FRAC_EPS < remChat) {
    return {
      monthly: {
        ...monthlyQuotas,
        chat: monthlyQuotas.completions,
        completions: monthlyQuotas.chat,
      },
      used: {
        ...usedQuotas,
        chat: usedQuotas.completions,
        completions: usedQuotas.chat,
      },
    };
  }

  const minT = Math.min(ct, cpt);
  const maxT = Math.max(ct, cpt);
  if (minT <= 0 || maxT < minT * GITHUB_CHAT_COMPLETIONS_MIN_RATIO) {
    return { monthly: monthlyQuotas, used: usedQuotas };
  }
  if (ct <= cpt) {
    return { monthly: monthlyQuotas, used: usedQuotas };
  }
  return {
    monthly: {
      ...monthlyQuotas,
      chat: monthlyQuotas.completions,
      completions: monthlyQuotas.chat,
    },
    used: {
      ...usedQuotas,
      chat: usedQuotas.completions,
      completions: usedQuotas.chat,
    },
  };
}
