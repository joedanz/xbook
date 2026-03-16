import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock next/cache before importing actions
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

// Mock session helper
vi.mock("@/lib/session", () => ({
  requireUser: () => Promise.resolve({ userId: "local" }),
}));

// Mock repository
const mockRepo = {
  deleteBookmark: vi.fn(),
  moveBookmarkToFolder: vi.fn(),
  updateBookmarkNotes: vi.fn(),
  addBookmarkTag: vi.fn(),
  removeBookmarkTag: vi.fn(),
  toggleStarred: vi.fn(),
  toggleNeedToRead: vi.fn(),
  getNewBookmarks: vi.fn(),
  markNewslettered: vi.fn(),
  logNewsletter: vi.fn(),
};
vi.mock("@/lib/db", () => ({
  getRepository: () => mockRepo,
}));

// Mock rate-limit — default to allowed; override in specific tests
const mockCheckRateLimit = vi.fn().mockResolvedValue({
  allowed: true,
  remaining: 99,
  resetAt: Date.now() + 60000,
});
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit"
  );
  return {
    ...actual,
    checkRateLimit: mockCheckRateLimit,
  };
});

// Mock newsletter HTML renderer
const mockRenderNewsletter = vi.fn();
vi.mock("@shared/newsletter", () => ({
  renderNewsletter: (...args: unknown[]) => mockRenderNewsletter(...args),
}));

// Mock email sender
const mockSendEmail = vi.fn();
vi.mock("@shared/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// Import after mocks are set up
const {
  deleteBookmark,
  moveBookmark,
  updateNotes,
  addTag,
  removeTag,
  toggleStarred,
  toggleNeedToRead,
  sendNewsletter,
  previewNewsletter,
  // updateNewsletterSettings removed (cloud-only)
} = await import("@/lib/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteBookmark", () => {
  it("calls repo.deleteBookmark and revalidates on success", async () => {
    mockRepo.deleteBookmark.mockResolvedValue(true);
    const result = await deleteBookmark("tweet-1");

    expect(mockRepo.deleteBookmark).toHaveBeenCalledWith("tweet-1");
    expect(revalidatePath).toHaveBeenCalledWith("/bookmarks");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(result).toEqual({ success: true });
  });

  it("does NOT revalidate when repo returns false", async () => {
    mockRepo.deleteBookmark.mockResolvedValue(false);
    const result = await deleteBookmark("tweet-missing");

    expect(revalidatePath).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false });
  });
});

describe("moveBookmark", () => {
  it("passes folderId and folderName to repo correctly", async () => {
    mockRepo.moveBookmarkToFolder.mockResolvedValue(true);
    await moveBookmark("tweet-1", "folder-abc", "My Folder");

    expect(mockRepo.moveBookmarkToFolder).toHaveBeenCalledWith(
      "tweet-1",
      "folder-abc",
      "My Folder"
    );
  });
});

describe("updateNotes", () => {
  it("trims whitespace; whitespace-only becomes null", async () => {
    mockRepo.updateBookmarkNotes.mockResolvedValue(true);
    await updateNotes("tweet-1", "   ");

    expect(mockRepo.updateBookmarkNotes).toHaveBeenCalledWith("tweet-1", null);
  });

  it("trims leading/trailing whitespace from real content", async () => {
    mockRepo.updateBookmarkNotes.mockResolvedValue(true);
    await updateNotes("tweet-1", "  some notes  ");

    expect(mockRepo.updateBookmarkNotes).toHaveBeenCalledWith(
      "tweet-1",
      "some notes"
    );
  });
});

describe("addTag", () => {
  it("lowercases and trims input", async () => {
    mockRepo.addBookmarkTag.mockResolvedValue(true);
    await addTag("tweet-1", "  TypeScript  ");

    expect(mockRepo.addBookmarkTag).toHaveBeenCalledWith(
      "tweet-1",
      "typescript"
    );
  });

  it("returns { success: false } for empty string", async () => {
    const result = await addTag("tweet-1", "   ");

    expect(mockRepo.addBookmarkTag).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false });
  });
});

describe("removeTag", () => {
  it("calls repo.removeBookmarkTag with correct args", async () => {
    mockRepo.removeBookmarkTag.mockResolvedValue(true);
    await removeTag("tweet-1", "react");

    expect(mockRepo.removeBookmarkTag).toHaveBeenCalledWith("tweet-1", "react");
  });
});

describe("toggleStarred", () => {
  it("calls repo and always revalidates both paths", async () => {
    mockRepo.toggleStarred.mockResolvedValue(true);
    const result = await toggleStarred("tweet-1");

    expect(mockRepo.toggleStarred).toHaveBeenCalledWith("tweet-1");
    expect(revalidatePath).toHaveBeenCalledWith("/bookmarks");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(result).toEqual({ success: true, starred: true });
  });
});

describe("toggleNeedToRead", () => {
  it("calls repo and always revalidates both paths", async () => {
    mockRepo.toggleNeedToRead.mockResolvedValue(false);
    const result = await toggleNeedToRead("tweet-1");

    expect(mockRepo.toggleNeedToRead).toHaveBeenCalledWith("tweet-1");
    expect(revalidatePath).toHaveBeenCalledWith("/bookmarks");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(result).toEqual({ success: true, needToRead: false });
  });
});

// ---------------------------------------------------------------------------
// sendNewsletter
// ---------------------------------------------------------------------------

const MOCK_BOOKMARKS = [
  {
    tweet_id: "111",
    text: "Great article on TypeScript",
    author_name: "Alice",
    author_username: "alice",
    created_at: "2026-03-01T12:00:00Z",
    folder_name: null,
  },
  {
    tweet_id: "222",
    text: "Interesting thread on React",
    author_name: "Bob",
    author_username: "bob",
    created_at: "2026-03-02T12:00:00Z",
    folder_name: "React",
  },
];

describe("sendNewsletter", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Restore env to clean state before each newsletter test
    process.env = { ...originalEnv };
    // Set up the default happy-path env
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NEWSLETTER_TO = "joe@example.com";
    // Reset mocks to happy-path defaults
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetAt: Date.now() + 300000,
    });
    mockRepo.getNewBookmarks.mockResolvedValue(MOCK_BOOKMARKS);
    mockRenderNewsletter.mockReturnValue({
      subject: "Your X Bookmarks — March 3, 2026",
      html: "<html>newsletter</html>",
    });
    mockSendEmail.mockResolvedValue(undefined);
    mockRepo.markNewslettered.mockResolvedValue(undefined);
    mockRepo.logNewsletter.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("happy path: generates newsletter, sends email, marks bookmarks, and revalidates", async () => {
    const result = await sendNewsletter();

    // Verify rate limit check used the newsletter-specific key
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "newsletter:local",
      expect.objectContaining({ limit: 3, windowSeconds: 300 })
    );

    // Verify bookmarks fetched
    expect(mockRepo.getNewBookmarks).toHaveBeenCalled();

    // Verify newsletter rendered with bookmarks
    expect(mockRenderNewsletter).toHaveBeenCalledWith(MOCK_BOOKMARKS);

    // Verify email sent with correct args
    expect(mockSendEmail).toHaveBeenCalledWith(
      "re_test_key",
      "xbook <noreply@example.com>",
      "joe@example.com",
      "Your X Bookmarks — March 3, 2026",
      "<html>newsletter</html>"
    );

    // Verify bookmarks marked as newslettered AFTER send
    expect(mockRepo.markNewslettered).toHaveBeenCalledWith(["111", "222"]);
    expect(mockRepo.logNewsletter).toHaveBeenCalledWith(2);

    // Verify revalidation
    expect(revalidatePath).toHaveBeenCalledWith("/newsletter");

    // Verify result
    expect(result).toEqual({
      success: true,
      message: "Newsletter sent with 2 bookmarks",
      count: 2,
    });
  });

  it("returns early with message when no new bookmarks exist", async () => {
    mockRepo.getNewBookmarks.mockResolvedValue([]);

    const result = await sendNewsletter();

    expect(result).toEqual({
      success: true,
      message: "No new bookmarks to send",
      count: 0,
    });

    // Should not attempt to render, send, or mark anything
    expect(mockRenderNewsletter).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockRepo.markNewslettered).not.toHaveBeenCalled();
    expect(mockRepo.logNewsletter).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns error when RESEND_API_KEY is not configured", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendNewsletter();

    expect(result).toEqual({
      success: false,
      error: "RESEND_API_KEY not configured",
    });

    // Should not attempt to send
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockRepo.markNewslettered).not.toHaveBeenCalled();
  });

  it("returns error when no newsletter email is configured (local mode)", async () => {
    delete process.env.NEWSLETTER_TO;

    const result = await sendNewsletter();

    expect(result).toEqual({
      success: false,
      error: "No newsletter email configured",
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns error when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 300000,
    });

    const result = await sendNewsletter();

    expect(result).toEqual({
      success: false,
      error: "Too many requests. Please wait before sending another newsletter.",
    });

    // Should not proceed past rate limit
    expect(mockRepo.getNewBookmarks).not.toHaveBeenCalled();
    expect(mockRenderNewsletter).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("handles email send failure gracefully without marking bookmarks", async () => {
    mockSendEmail.mockRejectedValue(new Error("Resend API error: 429 rate limited"));

    const result = await sendNewsletter();

    expect(result).toEqual({
      success: false,
      error: "Newsletter email failed to send. Bookmarks will be included in the next newsletter.",
    });

    // Critical: bookmarks must NOT be marked as newslettered on failure
    expect(mockRepo.markNewslettered).not.toHaveBeenCalled();
    expect(mockRepo.logNewsletter).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("marks bookmarks AFTER successful email send (atomic pattern)", async () => {
    // Track call order to verify sequencing
    const callOrder: string[] = [];
    mockSendEmail.mockImplementation(async () => {
      callOrder.push("sendEmail");
    });
    mockRepo.markNewslettered.mockImplementation(async () => {
      callOrder.push("markNewslettered");
    });
    mockRepo.logNewsletter.mockImplementation(async () => {
      callOrder.push("logNewsletter");
    });

    await sendNewsletter();

    expect(callOrder).toEqual(["sendEmail", "markNewslettered", "logNewsletter"]);
  });

  it("passes all bookmark tweet_ids to markNewslettered", async () => {
    const threeBookmarks = [
      { tweet_id: "aaa", text: "t1", author_name: "A", author_username: "a", created_at: null, folder_name: null },
      { tweet_id: "bbb", text: "t2", author_name: "B", author_username: "b", created_at: null, folder_name: null },
      { tweet_id: "ccc", text: "t3", author_name: "C", author_username: "c", created_at: null, folder_name: null },
    ];
    mockRepo.getNewBookmarks.mockResolvedValue(threeBookmarks);

    await sendNewsletter();

    expect(mockRepo.markNewslettered).toHaveBeenCalledWith(["aaa", "bbb", "ccc"]);
    expect(mockRepo.logNewsletter).toHaveBeenCalledWith(3);
  });
});

// ---------------------------------------------------------------------------
// previewNewsletter
// ---------------------------------------------------------------------------

describe("previewNewsletter", () => {
  it("returns error when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });

    const result = await previewNewsletter();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Too many requests");
    expect(result.html).toBeNull();
  });

  it("returns preview HTML when bookmarks exist", async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 59,
      resetAt: Date.now() + 60000,
    });
    mockRepo.getNewBookmarks.mockResolvedValue(MOCK_BOOKMARKS);
    mockRenderNewsletter.mockReturnValue({
      subject: "Your X Bookmarks — March 6, 2026",
      html: "<html>preview</html>",
    });

    const result = await previewNewsletter();

    expect(result.success).toBe(true);
    expect(result.html).toBe("<html>preview</html>");
    expect(result.count).toBe(2);
    expect(result.error).toBeNull();
  });

  it("returns message when no bookmarks to preview", async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 59,
      resetAt: Date.now() + 60000,
    });
    mockRepo.getNewBookmarks.mockResolvedValue([]);

    const result = await previewNewsletter();

    expect(result.success).toBe(true);
    expect(result.message).toBe("No new bookmarks to preview");
    expect(result.count).toBe(0);
    expect(result.html).toBeNull();
  });
});
