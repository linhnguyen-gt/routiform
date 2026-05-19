import { DEVIN_CONFIG } from "../constants/oauth";

export const devin = {
  config: DEVIN_CONFIG,
  flowType: "import_token",
  mapTokens: (tokens) => ({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken || null,
    expiresIn: tokens.expiresIn || 86400,
    providerSpecificData: {
      authMethod: "imported",
      cliVersion: tokens.cliVersion,
    },
  }),
};
