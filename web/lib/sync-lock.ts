// ABOUTME: In-memory sync lock to prevent concurrent syncs.
// ABOUTME: Uses a Map with TTL-based expiry.

const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

const localLocks = new Map<string, number>();

export async function acquireSyncLock(userId: string): Promise<boolean> {
  const now = Date.now();
  const existing = localLocks.get(userId);
  if (existing !== undefined && now - existing < LOCK_TTL_MS) {
    return false;
  }
  localLocks.set(userId, now);
  return true;
}

export async function releaseSyncLock(userId: string): Promise<void> {
  localLocks.delete(userId);
}
