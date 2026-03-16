// ABOUTME: Input validation helpers for API routes.
// ABOUTME: Prevents excessive page sizes.

/**
 * Clamp page size to a maximum of 100 items per request.
 */
export function clampPageSize(pageSize: unknown, defaultSize = 20): number {
  const n = typeof pageSize === "number" ? pageSize : parseInt(String(pageSize), 10);
  if (isNaN(n) || n < 1) return defaultSize;
  return Math.min(n, 100);
}
