"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { checkRateLimit, ACTION_RATE_LIMIT } from "@/lib/rate-limit";
import type { Tweet, User } from "@shared/types";

const MAX_TWEET_ID_LEN = 30;
const MAX_TAG_LEN = 100;
const MAX_FOLDER_ID_LEN = 100;
const MAX_FOLDER_NAME_LEN = 200;
const MAX_IMPORT_TWEETS = 50_000;

function validateId(id: string, label: string, maxLen = MAX_TWEET_ID_LEN) {
  if (typeof id !== "string" || id.length === 0 || id.length > maxLen) {
    return { success: false as const, error: `Invalid ${label}` };
  }
  return null;
}

export async function hideBookmark(tweetId: string) {
  const invalid = validateId(tweetId, "tweet ID");
  if (invalid) return invalid;
  const { userId } = await requireUser();
  const rl = await checkRateLimit(`action:${userId}`, ACTION_RATE_LIMIT);
  if (!rl.allowed) return { success: false as const, error: "Too many requests" };
  const repo = getRepository();
  const hidden = await repo.hideBookmark(tweetId);
  if (hidden) {
    revalidatePath("/bookmarks");
    revalidatePath("/dashboard");
  }
  return { success: hidden };
}

export async function unhideBookmark(tweetId: string) {
  const invalid = validateId(tweetId, "tweet ID");
  if (invalid) return invalid;
  const { userId } = await requireUser();
  const rl = await checkRateLimit(`action:${userId}`, ACTION_RATE_LIMIT);
  if (!rl.allowed) return { success: false as const, error: "Too many requests" };
  const repo = getRepository();
  const unhidden = await repo.unhideBookmark(tweetId);
  if (unhidden) {
    revalidatePath("/bookmarks");
    revalidatePath("/dashboard");
  }
  return { success: unhidden };
}

export async function moveBookmark(
  tweetId: string,
  folderId: string | null,
  folderName: string | null
) {
  const invalid = validateId(tweetId, "tweet ID");
  if (invalid) return invalid;
  if (folderId !== null) {
    const invalid = validateId(folderId, "folder ID", MAX_FOLDER_ID_LEN);
    if (invalid) return invalid;
  }
  if (folderName !== null && folderName.length > MAX_FOLDER_NAME_LEN) {
    return { success: false, error: "Folder name too long" };
  }
  const { userId } = await requireUser();
  const rl = await checkRateLimit(`action:${userId}`, ACTION_RATE_LIMIT);
  if (!rl.allowed) return { success: false, error: "Too many requests" };
  const repo = getRepository();
  const moved = await repo.moveBookmarkToFolder(tweetId, folderId, folderName);
  if (moved) {
    revalidatePath("/bookmarks");
    revalidatePath("/dashboard");
    if (folderId) revalidatePath(`/bookmarks/${folderId}`);
  }
  return { success: moved };
}

export async function updateNotes(tweetId: string, notes: string) {
  const invalid = validateId(tweetId, "tweet ID");
  if (invalid) return invalid;
  const { userId } = await requireUser();
  const rl = await checkRateLimit(`action:${userId}`, ACTION_RATE_LIMIT);
  if (!rl.allowed) return { success: false, error: "Too many requests" };
  const repo = getRepository();
  const trimmed = notes.trim() || null;
  if (trimmed && trimmed.length > 10000) {
    return { success: false, error: "Notes must be 10,000 characters or less" };
  }
  const updated = await repo.updateBookmarkNotes(tweetId, trimmed);
  if (updated) {
    revalidatePath("/bookmarks");
  }
  return { success: updated };
}

export async function addTag(tweetId: string, tag: string) {
  const invalid = validateId(tweetId, "tweet ID");
  if (invalid) return invalid;
  const { userId } = await requireUser();
  const rl = await checkRateLimit(`action:${userId}`, ACTION_RATE_LIMIT);
  if (!rl.allowed) return { success: false, error: "Too many requests" };
  const repo = getRepository();
  const trimmed = tag.trim().toLowerCase();
  if (!trimmed) return { success: false };
  if (trimmed.length > MAX_TAG_LEN) return { success: false, error: "Tag too long" };
  const added = await repo.addBookmarkTag(tweetId, trimmed);
  if (added) {
    revalidatePath("/bookmarks");
  }
  return { success: added };
}

export async function removeTag(tweetId: string, tag: string) {
  const invalid = validateId(tweetId, "tweet ID");
  if (invalid) return invalid;
  if (typeof tag !== "string" || tag.length > MAX_TAG_LEN) {
    return { success: false, error: "Invalid tag" };
  }
  const { userId } = await requireUser();
  const rl = await checkRateLimit(`action:${userId}`, ACTION_RATE_LIMIT);
  if (!rl.allowed) return { success: false, error: "Too many requests" };
  const repo = getRepository();
  const removed = await repo.removeBookmarkTag(tweetId, tag);
  if (removed) {
    revalidatePath("/bookmarks");
  }
  return { success: removed };
}

export async function toggleStarred(tweetId: string) {
  const invalid = validateId(tweetId, "tweet ID");
  if (invalid) return invalid;
  const { userId } = await requireUser();
  const rl = await checkRateLimit(`action:${userId}`, ACTION_RATE_LIMIT);
  if (!rl.allowed) return { success: false, error: "Too many requests" };
  const repo = getRepository();
  const starred = await repo.toggleStarred(tweetId);
  revalidatePath("/bookmarks");
  revalidatePath("/dashboard");
  return { success: true, starred };
}

export async function toggleNeedToRead(tweetId: string) {
  const invalid = validateId(tweetId, "tweet ID");
  if (invalid) return invalid;
  const { userId } = await requireUser();
  const rl = await checkRateLimit(`action:${userId}`, ACTION_RATE_LIMIT);
  if (!rl.allowed) return { success: false, error: "Too many requests" };
  const repo = getRepository();
  const needToRead = await repo.toggleNeedToRead(tweetId);
  revalidatePath("/bookmarks");
  revalidatePath("/dashboard");
  return { success: true, needToRead };
}

export async function sendNewsletter() {
  const { userId } = await requireUser();
  const { checkRateLimit, NEWSLETTER_RATE_LIMIT } = await import("@/lib/rate-limit");
  const rl = await checkRateLimit(`newsletter:${userId}`, NEWSLETTER_RATE_LIMIT);
  if (!rl.allowed) {
    return { success: false, error: "Too many requests. Please wait before sending another newsletter." };
  }
  const repo = getRepository();
  const bookmarks = await repo.getNewBookmarks();

  if (bookmarks.length === 0) {
    return { success: true, message: "No new bookmarks to send", count: 0 };
  }

  const { renderNewsletter } = await import("@shared/newsletter");
  const { subject, html } = renderNewsletter(bookmarks);

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const recipientEmail = process.env.NEWSLETTER_TO || null;

  if (!recipientEmail) {
    return { success: false, error: "No newsletter email configured" };
  }

  const { sendEmail } = await import("@shared/email");
  const newsletterFrom = process.env.NEWSLETTER_FROM || "xbook <noreply@example.com>";
  try {
    await sendEmail(resendApiKey, newsletterFrom, recipientEmail, subject, html);
  } catch {
    return { success: false, error: "Newsletter email failed to send. Bookmarks will be included in the next newsletter." };
  }

  const tweetIds = bookmarks.map((b) => b.tweet_id);
  try {
    await repo.markNewslettered(tweetIds);
    await repo.logNewsletter(bookmarks.length);
  } catch (err) {
    console.error("Failed to mark bookmarks as newslettered:", err);
    return {
      success: false,
      error: "Newsletter was sent but failed to update bookmark status. The same bookmarks may appear in your next newsletter.",
      count: bookmarks.length,
    };
  }
  revalidatePath("/newsletter");

  return { success: true, message: `Newsletter sent with ${bookmarks.length} bookmarks`, count: bookmarks.length };
}

export async function previewNewsletter() {
  const { userId } = await requireUser();
  const rl = await checkRateLimit(`action:${userId}`, ACTION_RATE_LIMIT);
  if (!rl.allowed) return { success: false, message: null, count: 0, html: null, error: "Too many requests" };
  const repo = getRepository();
  const bookmarks = await repo.getNewBookmarks();

  if (bookmarks.length === 0) {
    return { success: true, message: "No new bookmarks to preview", count: 0, html: null, error: null };
  }

  const { renderNewsletter } = await import("@shared/newsletter");
  const { subject, html } = renderNewsletter(bookmarks);

  return { success: true, subject, count: bookmarks.length, html, error: null };
}

export async function importBookmarks(
  tweets: Array<{ id: string; text: string; created_at?: string; author_id?: string; entities?: unknown }>,
  usersObj: Record<string, { id: string; name: string; username: string }>,
  format?: string
) {
  const { userId } = await requireUser();
  const { checkRateLimit, IMPORT_RATE_LIMIT: SA_IMPORT_LIMIT } = await import("@/lib/rate-limit");
  const rl = await checkRateLimit(`import:${userId}`, SA_IMPORT_LIMIT);
  if (!rl.allowed) {
    return { success: false, total: 0, imported: 0, skipped: 0, errors: 0, error: "Too many import requests." };
  }
  if (tweets.length > MAX_IMPORT_TWEETS) {
    return { success: false, total: 0, imported: 0, skipped: 0, errors: 0, format, error: `Too many items (max ${MAX_IMPORT_TWEETS})` };
  }
  const repo = getRepository();

  // Validate each tweet has required fields before casting to Tweet[]
  function validateTweetData(item: unknown): item is Tweet {
    if (!item || typeof item !== "object") return false;
    const t = item as Record<string, unknown>;
    const id = typeof t.id_str === "string" ? t.id_str : typeof t.id === "string" ? t.id : null;
    const text = typeof t.full_text === "string" ? t.full_text : typeof t.text === "string" ? t.text : null;
    if (!id || !text) return false;
    return id.length <= 30 && text.length <= 10_000;
  }

  const typedTweets = (tweets as unknown[]).filter(validateTweetData);
  const users = new Map(Object.entries(usersObj)) as Map<string, User>;
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  const CHUNK_SIZE = 500;
  for (let i = 0; i < typedTweets.length; i += CHUNK_SIZE) {
    const chunk = typedTweets.slice(i, i + CHUNK_SIZE);
    try {
      const result = await repo.upsertBookmarksBatch(chunk, users);
      imported += result.imported;
      skipped += result.skipped;
    } catch {
      errors += chunk.length;
    }
  }

  revalidatePath("/bookmarks");
  revalidatePath("/dashboard");

  return { success: true, total: tweets.length, imported, skipped, errors, format };
}

