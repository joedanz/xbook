// ABOUTME: Tests for web/lib/sync-lock.ts — in-memory sync lock.
// ABOUTME: Covers acquire, release, double-acquire rejection, and re-acquire after release.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { acquireSyncLock, releaseSyncLock } from "../web/lib/sync-lock";


describe("acquireSyncLock / releaseSyncLock (local mode)", () => {
  // Use unique user IDs per test to avoid cross-test pollution
  let userCounter = 0;
  function uniqueUser() {
    return `test-user-${Date.now()}-${userCounter++}`;
  }

  it("acquires lock for a new user", async () => {
    const userId = uniqueUser();
    const acquired = await acquireSyncLock(userId);
    expect(acquired).toBe(true);

    // Cleanup
    await releaseSyncLock(userId);
  });

  it("rejects second acquire for same user", async () => {
    const userId = uniqueUser();

    const first = await acquireSyncLock(userId);
    const second = await acquireSyncLock(userId);

    expect(first).toBe(true);
    expect(second).toBe(false);

    await releaseSyncLock(userId);
  });

  it("allows re-acquire after release", async () => {
    const userId = uniqueUser();

    await acquireSyncLock(userId);
    await releaseSyncLock(userId);

    const reacquired = await acquireSyncLock(userId);
    expect(reacquired).toBe(true);

    await releaseSyncLock(userId);
  });

  it("allows different users to hold locks simultaneously", async () => {
    const user1 = uniqueUser();
    const user2 = uniqueUser();

    const r1 = await acquireSyncLock(user1);
    const r2 = await acquireSyncLock(user2);

    expect(r1).toBe(true);
    expect(r2).toBe(true);

    await releaseSyncLock(user1);
    await releaseSyncLock(user2);
  });

  it("release is idempotent (releasing twice does not throw)", async () => {
    const userId = uniqueUser();

    await acquireSyncLock(userId);
    await releaseSyncLock(userId);
    await releaseSyncLock(userId); // Should not throw

    // Lock should be available again
    const reacquired = await acquireSyncLock(userId);
    expect(reacquired).toBe(true);

    await releaseSyncLock(userId);
  });

  it("releasing a never-acquired lock does not throw", async () => {
    const userId = uniqueUser();

    // Should not throw even though lock was never acquired
    await releaseSyncLock(userId);
  });
});
