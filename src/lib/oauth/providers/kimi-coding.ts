import { KIMI_CODING_CONFIG } from "../constants/oauth";
import { randomUUID } from "crypto";
import { hostname } from "os";

// Generate device ID (persistent per installation)
const DEVICE_ID = randomUUID();
const PLATFORM = "routiform";
const VERSION = "2.1.2";
const DEVICE_NAME = hostname();
const DEVICE_MODEL = `${process.platform} ${process.arch}`;

// Custom headers required by Kimi OAuth
function getKimiOAuthHeaders() {
  return {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    "X-Msh-Platform": PLATFORM,
    "X-Msh-Version": VERSION,
    "X-Msh-Device-Name": DEVICE_NAME,
    "X-Msh-Device-Model": DEVICE_MODEL,
    "X-Msh-Device-Id": DEVICE_ID,
  };
}

export const kimiCoding = {
  config: KIMI_CODING_CONFIG,
  flowType: "device_code",
  requestDeviceCode: async (config) => {
    const response = await fetch(config.deviceCodeUrl, {
      method: "POST",
      headers: getKimiOAuthHeaders(),
      body: new URLSearchParams({
        client_id: config.clientId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Device code request failed: ${error}`);
    }

    const data = await response.json();
    return {
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri || `https://auth.kimi.com/activate`,
      verification_uri_complete:
        data.verification_uri_complete ||
        `https://auth.kimi.com/activate?user_code=${data.user_code}`,
      expires_in: data.expires_in,
      interval: data.interval || 5,
    };
  },
  pollToken: async (config, deviceCode) => {
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: getKimiOAuthHeaders(),
      body: new URLSearchParams({
        client_id: config.clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    let data;
    try {
      data = await response.json();
    } catch (e) {
      const text = await response.text();
      data = { error: "invalid_response", error_description: text };
    }

    return {
      ok: response.ok,
      data: data,
    };
  },
  mapTokens: (tokens) => ({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    tokenType: tokens.token_type,
    scope: tokens.scope,
  }),
};
