// GitHub API config
export const GITHUB_CONFIG = {
  apiVersion: "2022-11-28",
  userAgent: "GitHubCopilotChat/0.26.7",
};

/**
 * When both caps are similar, prefer smaller entitlement as Chat (message cap) vs larger as
 * Completions (IDE quota).
 */
export const GITHUB_CHAT_COMPLETIONS_MIN_RATIO = 2;

export const GITHUB_REMAINING_FRAC_EPS = 1e-5;
