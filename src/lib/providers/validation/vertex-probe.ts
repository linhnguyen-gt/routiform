import { withCustomUserAgent } from "./http-utils";

export type VertexProbeResult = {
  valid: boolean;
  authRejected?: boolean;
  upstream?: boolean;
  status?: number;
  warning?: string;
};

export async function classifyVertexProbeResponse(response: Response): Promise<VertexProbeResult> {
  if (response.status === 401) {
    return { valid: false, authRejected: true };
  }

  if (response.status === 403) {
    let bodyText = "";
    try {
      bodyText = (await response.text()).toLowerCase();
    } catch {
      bodyText = "";
    }

    const looksLikeAuthFailure =
      bodyText.includes("api key not valid") ||
      bodyText.includes("invalid authentication") ||
      bodyText.includes("unauthenticated");

    if (looksLikeAuthFailure) {
      return { valid: false, authRejected: true };
    }

    return {
      valid: true,
      warning: "Credentials accepted but missing project/model permission for validation probe",
    };
  }

  if (response.status >= 500) {
    return { valid: false, upstream: true, status: response.status };
  }

  if (response.ok) {
    return { valid: true };
  }

  // Non-auth 4xx (400/404/405/409/422/429) means the upstream accepted auth and
  // rejected request/project/model shape.
  return { valid: true, warning: "Credentials accepted; request probe returned non-auth status" };
}

export async function probeVertexInferenceRequest(params: {
  probeUrl: string;
  probeBody: string;
  headers: Record<string, string>;
  providerSpecificData: Record<string, unknown>;
}): Promise<VertexProbeResult> {
  const { probeUrl, probeBody, headers, providerSpecificData } = params;
  const response = await fetch(
    probeUrl,
    withCustomUserAgent(
      {
        method: "POST",
        headers,
        body: probeBody,
      },
      providerSpecificData
    )
  );
  return classifyVertexProbeResponse(response);
}
