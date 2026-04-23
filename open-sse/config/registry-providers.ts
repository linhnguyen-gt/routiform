/**
 * Provider registry data — all 60+ provider configurations.
 */

import type { RegistryEntry } from "./registry-types.ts";
import { APIKEY_PROVIDERS } from "./registry-providers-apikey.ts";
import { FREE_PROVIDERS } from "./registry-providers-free.ts";
import { LOCAL_PROVIDERS } from "./registry-providers-local.ts";
import { OAUTH_PROVIDERS } from "./registry-providers-oauth.ts";

export const REGISTRY: Record<string, RegistryEntry> = {
  ...OAUTH_PROVIDERS,
  ...APIKEY_PROVIDERS,
  ...FREE_PROVIDERS,
  ...LOCAL_PROVIDERS,
};
