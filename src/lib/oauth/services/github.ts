import { OAuthService } from "./oauth";
import { GITHUB_CONFIG } from "../constants/oauth";
import { spinner as createSpinner } from "../utils/ui";

/**
 * GitHub Copilot OAuth Service
 * Uses Device Code Flow for authentication
 */
export class GitHubService extends OAuthService {
  constructor() {
    super(GITHUB_CONFIG);
  }

  /**
   * Get device code for GitHub authentication
   */
  async getDeviceCode() {
    const response = await fetch(`${GITHUB_CONFIG.deviceCodeUrl}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: GITHUB_CONFIG.clientId,
        scope: GITHUB_CONFIG.scopes,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get device code: ${error}`);
    }

    return await response.json();
  }

  /**
   * Poll for access token using device code
   */
  async pollAccessToken(
    deviceCode: string,
    verificationUri: string,
    userCode: string,
    interval = 5000
  ) {
    const spinner = createSpinner("Waiting for GitHub authentication...").start();

    // Show user code and verification URL
    console.log(`\nPlease visit: ${verificationUri}`);
    console.log(`Enter code: ${userCode}\n`);

    // Open browser automatically
    try {
      const open = (await import("open")).default;
      await open(verificationUri);
    } catch (_error) {
      console.log("Could not open browser automatically. Please visit the URL above manually.");
    }

    // Poll for access token
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      const response = await fetch(`${GITHUB_CONFIG.tokenUrl}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: GITHUB_CONFIG.clientId,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        spinner.succeed("GitHub authentication successful!");
        return {
          access_token: data.access_token,
          token_type: data.token_type,
          scope: data.scope,
        };
      } else if (data.error === "authorization_pending") {
        // Continue polling
        continue;
      } else if (data.error === "slow_down") {
        // Increase polling interval
        interval += 5000;
        continue;
      } else if (data.error === "expired_token") {
        spinner.fail("Device code expired. Please try again.");
        throw new Error("Device code expired");
      } else if (data.error === "access_denied") {
        spinner.fail("Access denied by user.");
        throw new Error("Access denied");
      } else {
        spinner.fail("Failed to get access token.");
        throw new Error(data.error_description || data.error);
      }
    }
  }

  /**
   * Get Copilot token using GitHub access token
   */
  async getCopilotToken(accessToken: string) {
    const response = await fetch(`${GITHUB_CONFIG.copilotTokenUrl}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`, // GitHub API typically uses Bearer
        Accept: "application/json",
        "X-GitHub-Api-Version": GITHUB_CONFIG.apiVersion,
        "User-Agent": GITHUB_CONFIG.userAgent,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get Copilot token: ${error}`);
    }

    return await response.json();
  }

  /**
   * Get user info using GitHub access token
   */
  async getUserInfo(accessToken: string) {
    const response = await fetch(`${GITHUB_CONFIG.userInfoUrl}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`, // GitHub API typically uses Bearer
        Accept: "application/json",
        "X-GitHub-Api-Version": GITHUB_CONFIG.apiVersion,
        "User-Agent": GITHUB_CONFIG.userAgent,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get user info: ${error}`);
    }

    return await response.json();
  }

  /**
   * Complete GitHub Copilot authentication flow
   */
  async authenticate(): Promise<{
    code: string;
    state: string;
    codeVerifier: string;
    redirectUri: string;
  }> {
    try {
      // Get device code
      const deviceResponse = await this.getDeviceCode();

      // Poll for access token
      const tokenResponse = await this.pollAccessToken(
        deviceResponse.device_code,
        deviceResponse.verification_uri,
        deviceResponse.user_code
      );

      // Get Copilot token
      const _copilotToken = await this.getCopilotToken(tokenResponse.access_token);

      // Get user info
      const userInfo = await this.getUserInfo(tokenResponse.access_token);

      console.log(`\n✅ Successfully authenticated as ${userInfo.login}`);

      return {
        code: tokenResponse.access_token,
        state: "",
        codeVerifier: "",
        redirectUri: "",
      };
    } catch (error) {
      console.error("GitHub authentication failed:", error);
      throw error;
    }
  }

  /**
   * Connect to server with GitHub credentials
   */
  async connect() {
    try {
      // Authenticate with GitHub
      const authResult = await this.authenticate();

      // Send credentials to server
      const { server, token, userId } = await import("../config/index").then((m) =>
        m.getServerCredentials()
      );
      const spinner = (await import("../utils/ui")).spinner("Connecting to server...").start();

      const response = await fetch(`${server}/api/cli/providers/github`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-Id": userId,
        },
        body: JSON.stringify({
          accessToken: authResult.code,
          copilotToken: authResult.code,
          userInfo: {},
          copilotTokenInfo: {},
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to connect to server");
      }

      spinner.succeed("GitHub Copilot connected successfully!");
      console.log(`\nConnected as: ${authResult.code}`);
    } catch (error) {
      const { error: showError } = await import("../utils/ui");
      const errMsg = error instanceof Error ? error.message : String(error);
      showError(`GitHub connection failed: ${errMsg}`);
      throw error;
    }
  }
}
