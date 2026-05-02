import { CLINE_CONFIG } from "../constants/oauth";

export const cline = {
  config: CLINE_CONFIG,
  flowType: "authorization_code",
  buildAuthUrl: (config, redirectUri) => {
    const params = new URLSearchParams({
      client_type: "extension",
      callback_url: redirectUri,
      redirect_uri: redirectUri,
    });
    return `${config.authorizeUrl}?${params.toString()}`;
  },
  exchangeToken: async (config, code, redirectUri) => {
    const response = await fetch(config.tokenExchangeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: code,
        client_type: "extension",
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cline token exchange failed: ${error}`);
    }

    const data = await response.json();
    if (!data?.success || !data?.data) {
      throw new Error(`Cline token exchange failed: ${JSON.stringify(data)}`);
    }
    return {
      access_token: data.data.accessToken,
      refresh_token: data.data.refreshToken,
      email: data.data.userInfo?.email || "",
      firstName: data.data.userInfo?.name?.split(" ")[0] || "",
      lastName: data.data.userInfo?.name?.split(" ").slice(1).join(" ") || "",
      expires_at: data.data.expiresAt, // ISO 8601 string
    };
  },
  mapTokens: (tokens) => {
    const firstName = tokens.firstName || "";
    const lastName = tokens.lastName || "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const expiresAtMs = tokens.expires_at
      ? typeof tokens.expires_at === "number" && tokens.expires_at > 1_000_000_000
        ? tokens.expires_at * 1000
        : new Date(tokens.expires_at).getTime()
      : null;
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: expiresAtMs ? Math.floor((expiresAtMs - Date.now()) / 1000) : 3600,
      // Use full name if available, fallback to email so UI shows a real label
      name: fullName || tokens.email || null,
      email: tokens.email,
      providerSpecificData: {
        firstName: tokens.firstName,
        lastName: tokens.lastName,
      },
    };
  },
};
