// ABOUTME: Session helper to extract userId.
// ABOUTME: Always returns "local" for single-user mode.

export async function requireUser(): Promise<{ userId: string }> {
  return { userId: "local" };
}
