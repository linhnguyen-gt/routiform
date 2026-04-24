/**
 * Qwen Usage
 */
export async function getQwenUsage(accessToken, providerSpecificData) {
  try {
    const resourceUrl = providerSpecificData?.resourceUrl;
    if (!resourceUrl) {
      return { message: "Qwen connected. No resource URL available." };
    }

    // Qwen may have usage endpoint at resource URL
    return { message: "Qwen connected. Usage tracked per request." };
  } catch (_error) {
    return { message: "Unable to fetch Qwen usage." };
  }
}

/**
 * Qoder Usage
 */
export async function getIflowUsage(_accessToken) {
  try {
    // Qoder may have usage endpoint
    return { message: "Qoder connected. Usage tracked per request." };
  } catch (_error) {
    return { message: "Unable to fetch Qoder usage." };
  }
}
