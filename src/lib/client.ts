// ABOUTME: Thin HTTP client for xbook API.
// ABOUTME: Uses native fetch with API key auth header.

import type { CliConfig } from "./config";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export async function apiRequest(
  config: CliConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `${config.apiUrl}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "xbook-cli/0.1.0",
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new NetworkError(
      `Failed to connect to ${config.apiUrl}: ${(err as Error).message}`
    );
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.error || data?.message || `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return data;
}
