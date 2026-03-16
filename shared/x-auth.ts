// ABOUTME: Shared X (Twitter) OAuth2 token refresh utility.
// ABOUTME: Used by web API routes for refreshing access tokens with retry logic.

const TOKEN_URL = "https://api.x.com/2/oauth2/token";

export interface XTokenResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Refresh an X OAuth2 access token using a refresh token.
 * Retries on 429 rate limits and network errors with exponential backoff.
 */
export async function refreshXToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<XTokenResult> {
  const maxRetries = 3;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      res = await fetch(TOKEN_URL, {
        method: "POST",
        headers,
        body: body.toString(),
      });
    } catch (err) {
      if (attempt === maxRetries) {
        throw new Error(
          `Token refresh failed after ${maxRetries} retries: network error: ${err instanceof Error ? err.message : err}`
        );
      }
      const backoffMs = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      continue;
    }

    if (res.status === 429) {
      if (attempt === maxRetries) {
        throw new Error("Token refresh rate limited after maximum retries");
      }
      const reset = res.headers.get("x-rate-limit-reset");
      const waitMs = reset
        ? Math.max(1000, (parseInt(reset, 10) - Math.floor(Date.now() / 1000)) * 1000)
        : Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token refresh failed (${res.status}): ${text}`);
    }

    return (await res.json()) as XTokenResult;
  }

  throw new Error("Token refresh failed: unexpected end of retry loop");
}

/**
 * Web-friendly wrapper that maps X API snake_case response to camelCase.
 * Use this in web API routes instead of calling refreshXToken directly.
 */
export interface WebTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function refreshXTokenForWeb(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<WebTokenResult> {
  const result = await refreshXToken(refreshToken, clientId, clientSecret);
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: Date.now() + result.expires_in * 1000,
  };
}
