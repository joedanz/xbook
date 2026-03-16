// ABOUTME: API authentication for v1 endpoints.
// ABOUTME: In local mode (single-user), always returns userId "local".

export async function authenticateApiRequest(
  _request: Request
): Promise<{ userId: string } | { error: string; status: number }> {
  return { userId: "local" };
}
