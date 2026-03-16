// ABOUTME: Shared URL builder utilities for X/Twitter links.
// ABOUTME: Used by newsletter renderer and bookmark card component.

export function tweetUrl(tweetId: string, username: string | null): string {
  return `https://x.com/${username || "i"}/status/${tweetId}`;
}
