import { withCustomUserAgent } from "./http-utils";
import { hasVertexServiceAccountFields, parseVertexServiceAccount } from "./vertex-helpers";
import { probeVertexInferenceRequest } from "./vertex-probe";

export async function validateVertexProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  const serviceAccount = parseVertexServiceAccount(apiKey);
  if (serviceAccount) {
    if (!hasVertexServiceAccountFields(serviceAccount)) {
      return {
        valid: false,
        error: "Invalid Vertex Service Account JSON (missing client_email or private_key)",
      };
    }

    return {
      valid: true,
      error: null,
      method: "service_account_json",
      warning: "Service Account JSON shape is valid; token exchange is verified at runtime",
    };
  }

  const token = apiKey.trim();
  if (!token) {
    return { valid: false, error: "Invalid API key" };
  }

  const probeProjectId =
    typeof providerSpecificData.projectId === "string" &&
    providerSpecificData.projectId.trim().length > 0
      ? providerSpecificData.projectId.trim()
      : "vertex-validation-probe";
  const probeRegion =
    typeof providerSpecificData.region === "string" && providerSpecificData.region.trim().length > 0
      ? providerSpecificData.region.trim()
      : "us-central1";
  const probeUrl = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(probeProjectId)}/locations/${encodeURIComponent(probeRegion)}/publishers/google/models/gemini-2.5-flash:generateContent`;

  const probeBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: "test" }] }],
    generationConfig: { maxOutputTokens: 1 },
  });

  const probeVertexAuth = async (headers: Record<string, string>) =>
    probeVertexInferenceRequest({
      probeUrl,
      probeBody,
      headers,
      providerSpecificData,
    });

  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`;
    const response = await fetch(
      url,
      withCustomUserAgent(
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
        providerSpecificData
      )
    );

    if (response.ok) {
      const body = (await response.json()) as Record<string, unknown>;
      const scope = typeof body.scope === "string" ? body.scope : "";
      const hasCloudScope =
        scope.includes("https://www.googleapis.com/auth/cloud-platform") ||
        scope.includes("https://www.googleapis.com/auth/cloud-platform.read-only");

      return {
        valid: true,
        error: null,
        method: "oauth_token_info",
        warning: hasCloudScope ? null : "Access token may be missing cloud-platform scope",
      };
    }

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      // Some Vertex credential forms (especially API-key style values used with OpenAPI endpoints)
      // are not introspectable via tokeninfo. Probe Vertex inference endpoint directly before rejecting.
      try {
        const bearerProbe = await probeVertexAuth({
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        });
        if (bearerProbe.valid) {
          return {
            valid: true,
            error: null,
            method: "vertex_inference_probe_bearer",
            warning: bearerProbe.warning || null,
          };
        }

        const apiKeyProbe = await probeVertexAuth({
          "Content-Type": "application/json",
          "x-goog-api-key": token,
        });
        if (apiKeyProbe.valid) {
          return {
            valid: true,
            error: null,
            method: "vertex_inference_probe_apikey",
            warning: apiKeyProbe.warning || null,
          };
        }

        if (bearerProbe.authRejected && apiKeyProbe.authRejected) {
          return { valid: false, error: "Invalid API key" };
        }

        const upstreamStatus =
          (typeof bearerProbe.status === "number" && bearerProbe.status) ||
          (typeof apiKeyProbe.status === "number" && apiKeyProbe.status) ||
          null;
        if (upstreamStatus) {
          return { valid: false, error: `Provider unavailable (${upstreamStatus})` };
        }

        return {
          valid: false,
          error:
            "Validation inconclusive for Vertex credentials (check project/region or try runtime test)",
        };
      } catch (probeError: unknown) {
        return {
          valid: false,
          error: probeError instanceof Error ? probeError.message : "Validation failed",
        };
      }
    }

    return { valid: false, error: `Validation failed: ${response.status}` };
  } catch (error: unknown) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Validation failed",
    };
  }
}
