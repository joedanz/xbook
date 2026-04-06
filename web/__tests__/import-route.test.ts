// ABOUTME: Tests for POST /api/v1/import — covers all three input modes (multipart,
// ABOUTME: pre-parsed JSON, raw content JSON), auth, rate limiting, chunking, and error paths.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before the module under test is imported
// ---------------------------------------------------------------------------

const mockAuthenticateApiRequest = vi.fn();
vi.mock("@/lib/api-auth", () => ({
  authenticateApiRequest: (...args: unknown[]) => mockAuthenticateApiRequest(...args),
}));

const mockRepo = {
  upsertBookmarksBatch: vi.fn(),
};
const mockGetRepository = vi.fn((_userId: string) => mockRepo);
vi.mock("@/lib/db", () => ({
  getRepository: (userId: string) => mockGetRepository(userId),
}));

const mockCheckRateLimit = vi.fn();
const mockRateLimitResponse = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  rateLimitResponse: (...args: unknown[]) => mockRateLimitResponse(...args),
}));

const mockParseImportFile = vi.fn();
vi.mock("@shared/import-parser", () => ({
  parseImportFile: (...args: unknown[]) => mockParseImportFile(...args),
}));

// Import after mocks are set up
const { POST } = await import("@/app/api/v1/import/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_OK = { userId: "user-123" };
const AUTH_ERR = { error: "Missing API key. Use: Authorization: Bearer <api-key>", status: 401 };

const RL_ALLOWED = { allowed: true, remaining: 49, resetAt: Date.now() + 60_000 };
const RL_DENIED = { allowed: false, remaining: 0, resetAt: Date.now() + 60_000 };

function makeTweet(id: string) {
  return {
    id,
    text: `Tweet ${id}`,
    created_at: "2026-03-01T12:00:00Z",
    author_id: "user-1",
  };
}

function makeTweets(count: number) {
  return Array.from({ length: count }, (_, i) => makeTweet(String(i + 1)));
}

const USERS_OBJ: Record<string, { id: string; name: string; username: string }> = {
  "user-1": { id: "user-1", name: "Test User", username: "testuser" },
};

function makeUsersMap() {
  return new Map(Object.entries(USERS_OBJ));
}

/** Build a standard application/json POST request. */
function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Build a multipart/form-data POST request with an attached file. */
function multipartRequest(filename: string, content: string): Request {
  const formData = new FormData();
  const file = new File([content], filename, { type: "application/json" });
  formData.append("file", file);
  return new Request("http://localhost/api/v1/import", {
    method: "POST",
    body: formData,
  });
}

/** Build a multipart/form-data POST request without any file field. */
function multipartRequestNoFile(): Request {
  const formData = new FormData();
  return new Request("http://localhost/api/v1/import", {
    method: "POST",
    body: formData,
  });
}

// ---------------------------------------------------------------------------
// Default mock behaviours reset before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  mockAuthenticateApiRequest.mockResolvedValue(AUTH_OK);
  mockCheckRateLimit.mockResolvedValue(RL_ALLOWED);
  mockGetRepository.mockReturnValue(mockRepo);
  mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 0, skipped: 0 });

  // Default rateLimitResponse returns a plain 429 NextResponse
  mockRateLimitResponse.mockReturnValue(
    new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
  );
});

// ---------------------------------------------------------------------------
// 1. Authentication
// ---------------------------------------------------------------------------

describe("POST /api/v1/import — authentication", () => {
  it("returns the auth error status and message when authenticateApiRequest fails", async () => {
    mockAuthenticateApiRequest.mockResolvedValue(AUTH_ERR);

    const response = await POST(jsonRequest({ tweets: makeTweets(1), users: USERS_OBJ }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("API key");
    // Should never touch rate limit or repo
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockRepo.upsertBookmarksBatch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Rate limiting
// ---------------------------------------------------------------------------

describe("POST /api/v1/import — rate limiting", () => {
  it("delegates to rateLimitResponse and skips import when limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue(RL_DENIED);

    const response = await POST(jsonRequest({ tweets: makeTweets(5), users: USERS_OBJ }));

    expect(mockRateLimitResponse).toHaveBeenCalledTimes(1);
    expect(mockRateLimitResponse).toHaveBeenCalledWith(RL_DENIED);
    expect(response.status).toBe(429);
    expect(mockRepo.upsertBookmarksBatch).not.toHaveBeenCalled();
  });

  it("passes the correct rate-limit key scoped to the authenticated user", async () => {
    await POST(jsonRequest({ tweets: makeTweets(1), users: USERS_OBJ }));

    expect(mockCheckRateLimit).toHaveBeenCalledTimes(1);
    const [key, config] = mockCheckRateLimit.mock.calls[0];
    expect(key).toBe("import:user-123");
    expect(config).toEqual({ limit: 50, windowSeconds: 60 });
  });
});

// ---------------------------------------------------------------------------
// 3. Pre-parsed JSON — {tweets, users}
// ---------------------------------------------------------------------------

describe("POST /api/v1/import — pre-parsed JSON {tweets, users}", () => {
  it("imports tweets and returns correct counts", async () => {
    const tweets = makeTweets(10);
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 8, skipped: 2 });

    const response = await POST(jsonRequest({ tweets, users: USERS_OBJ }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      total: 10,
      imported: 8,
      skipped: 2,
      errors: 0,
      format: undefined,
      warnings: [],
    });
    expect(mockRepo.upsertBookmarksBatch).toHaveBeenCalledTimes(1);
  });

  it("passes the users Map (not plain object) to upsertBookmarksBatch", async () => {
    const tweets = makeTweets(3);
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 3, skipped: 0 });

    await POST(jsonRequest({ tweets, users: USERS_OBJ }));

    const usersArg = mockRepo.upsertBookmarksBatch.mock.calls[0][1];
    expect(usersArg).toBeInstanceOf(Map);
    expect(usersArg.get("user-1")).toEqual(USERS_OBJ["user-1"]);
  });

  it("passes format through to the response", async () => {
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 1, skipped: 0 });

    const response = await POST(
      jsonRequest({ tweets: makeTweets(1), users: USERS_OBJ, format: "twitter-archive" })
    );

    const body = await response.json();
    expect(body.format).toBe("twitter-archive");
  });

  it("filters out tweets missing id and returns 400 when all are invalid", async () => {
    const badTweets = [
      { text: "no id here" },                       // missing id
      { id: "", text: "empty id" },                 // empty id
      { id: "x".repeat(31), text: "id too long" },  // id > 30 chars
      { id: "valid-id" },                            // missing text (undefined passes ≤10k chars check, but let's verify actual behaviour)
    ];

    const response = await POST(jsonRequest({ tweets: badTweets, users: USERS_OBJ }));

    // The last entry has no text — typeof undefined !== "string" so it is also filtered
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/no valid tweets/i);
    expect(mockRepo.upsertBookmarksBatch).not.toHaveBeenCalled();
  });

  it("accepts tweets where text is empty string (length 0 satisfies ≤10k) and filters only on id validity", async () => {
    // A tweet with a valid id and empty text IS valid per the route's filter logic
    const tweets = [{ id: "tweet-1", text: "", author_id: "user-1", created_at: "2026-01-01" }];
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 1, skipped: 0 });

    const response = await POST(jsonRequest({ tweets, users: USERS_OBJ }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(1);
  });

  it("filters tweets whose text exceeds 10,000 characters and returns 400 if all are filtered", async () => {
    const longText = "a".repeat(10_001);
    const badTweets = [{ id: "tweet-1", text: longText, author_id: "user-1" }];

    const response = await POST(jsonRequest({ tweets: badTweets, users: USERS_OBJ }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/no valid tweets/i);
  });
});

// ---------------------------------------------------------------------------
// 4. Raw content JSON — {content, filename}
// ---------------------------------------------------------------------------

describe("POST /api/v1/import — raw content JSON {content, filename}", () => {
  it("parses content via parseImportFile and imports the result", async () => {
    const parsedTweets = makeTweets(5);
    mockParseImportFile.mockReturnValue({
      tweets: parsedTweets,
      users: makeUsersMap(),
      format: "bookmarks-json",
      warnings: [],
    });
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 5, skipped: 0 });

    const response = await POST(
      jsonRequest({ content: '{"some":"data"}', filename: "bookmarks.json" })
    );

    expect(mockParseImportFile).toHaveBeenCalledTimes(1);
    expect(mockParseImportFile).toHaveBeenCalledWith('{"some":"data"}', "bookmarks.json");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      total: 5,
      imported: 5,
      skipped: 0,
      errors: 0,
      format: "bookmarks-json",
      warnings: [],
    });
  });

  it("falls back to import.json when filename is omitted", async () => {
    mockParseImportFile.mockReturnValue({
      tweets: makeTweets(1),
      users: makeUsersMap(),
      format: undefined,
      warnings: [],
    });
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 1, skipped: 0 });

    await POST(jsonRequest({ content: "[]" }));

    expect(mockParseImportFile).toHaveBeenCalledWith("[]", "import.json");
  });

  it("returns 400 when content exceeds 10MB", async () => {
    // Construct a string whose UTF-8 byte length is just over 10MB
    const oversized = "x".repeat(10 * 1024 * 1024 + 1);

    const response = await POST(jsonRequest({ content: oversized, filename: "big.json" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/too large/i);
    expect(mockParseImportFile).not.toHaveBeenCalled();
    expect(mockRepo.upsertBookmarksBatch).not.toHaveBeenCalled();
  });

  it("forwards warnings from the parser in the response", async () => {
    const warnings = ["Unknown field ignored: foo", "Duplicate tweet id skipped: 42"];
    mockParseImportFile.mockReturnValue({
      tweets: makeTweets(2),
      users: makeUsersMap(),
      format: "csv",
      warnings,
    });
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 2, skipped: 0 });

    const response = await POST(jsonRequest({ content: "csv,data", filename: "export.csv" }));

    const body = await response.json();
    expect(body.warnings).toEqual(warnings);
    expect(body.format).toBe("csv");
  });
});

// ---------------------------------------------------------------------------
// 5. Multipart file upload
// ---------------------------------------------------------------------------

describe("POST /api/v1/import — multipart file upload", () => {
  it("parses the uploaded file and imports the result", async () => {
    const parsedTweets = makeTweets(3);
    mockParseImportFile.mockReturnValue({
      tweets: parsedTweets,
      users: makeUsersMap(),
      format: "twitter-archive",
      warnings: [],
    });
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 3, skipped: 0 });

    const response = await POST(multipartRequest("archive.json", '{"tweets":[]}'));

    expect(mockParseImportFile).toHaveBeenCalledTimes(1);
    const [, calledFilename] = mockParseImportFile.mock.calls[0];
    expect(calledFilename).toBe("archive.json");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      total: 3,
      imported: 3,
      skipped: 0,
      errors: 0,
      format: "twitter-archive",
      warnings: [],
    });
  });

  it("returns 400 when no file field is present in the form data", async () => {
    const response = await POST(multipartRequestNoFile());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/no file provided/i);
    expect(mockParseImportFile).not.toHaveBeenCalled();
    expect(mockRepo.upsertBookmarksBatch).not.toHaveBeenCalled();
  });

  it("returns 400 when the uploaded file exceeds 10MB", async () => {
    const oversizedContent = "x".repeat(10 * 1024 * 1024 + 1);

    const response = await POST(multipartRequest("big.json", oversizedContent));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/too large/i);
    expect(mockParseImportFile).not.toHaveBeenCalled();
    expect(mockRepo.upsertBookmarksBatch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. Invalid request body
// ---------------------------------------------------------------------------

describe("POST /api/v1/import — invalid request body", () => {
  it("returns 400 when body has neither tweets nor content", async () => {
    const response = await POST(jsonRequest({ something: "unexpected" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/invalid request/i);
    expect(mockRepo.upsertBookmarksBatch).not.toHaveBeenCalled();
  });

  it("returns 400 when tweets field is present but not an array", async () => {
    // tweets is a string, not an array — should fall through to the content/invalid branch
    const response = await POST(jsonRequest({ tweets: "not-an-array", users: USERS_OBJ }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/invalid request/i);
  });

  it("returns 400 when body is empty JSON object", async () => {
    const response = await POST(jsonRequest({}));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/invalid request/i);
  });
});

// ---------------------------------------------------------------------------
// 7. MAX_IMPORT_ITEMS guard (50,000)
// ---------------------------------------------------------------------------

describe("POST /api/v1/import — MAX_IMPORT_ITEMS", () => {
  it("returns 400 when tweet count exceeds 50,000", async () => {
    const oversizedTweets = new Array(50_001).fill(makeTweet("1"));

    const response = await POST(jsonRequest({ tweets: oversizedTweets, users: USERS_OBJ }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/too many items/i);
    expect(body.error).toContain("50000");
    expect(mockRepo.upsertBookmarksBatch).not.toHaveBeenCalled();
  });

  it("allows exactly 50,000 tweets without error", async () => {
    // Fill with real tweet objects (ids spread across string values)
    const tweets = new Array(50_000).fill(null).map((_, i) => makeTweet(String(i + 1)));
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 500, skipped: 0 });

    const response = await POST(jsonRequest({ tweets, users: USERS_OBJ }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(50_000);
  });
});

// ---------------------------------------------------------------------------
// 8. Chunking
// ---------------------------------------------------------------------------

describe("POST /api/v1/import — chunking", () => {
  it("splits 1,200 tweets into three batches (500 + 500 + 200)", async () => {
    const tweets = makeTweets(1_200);
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 0, skipped: 0 });

    await POST(jsonRequest({ tweets, users: USERS_OBJ }));

    expect(mockRepo.upsertBookmarksBatch).toHaveBeenCalledTimes(3);

    const [chunk1] = mockRepo.upsertBookmarksBatch.mock.calls[0];
    const [chunk2] = mockRepo.upsertBookmarksBatch.mock.calls[1];
    const [chunk3] = mockRepo.upsertBookmarksBatch.mock.calls[2];
    expect(chunk1).toHaveLength(500);
    expect(chunk2).toHaveLength(500);
    expect(chunk3).toHaveLength(200);
  });

  it("accumulates imported and skipped counts across all chunks", async () => {
    const tweets = makeTweets(1_500); // 3 chunks of 500
    mockRepo.upsertBookmarksBatch
      .mockResolvedValueOnce({ imported: 400, skipped: 100 })
      .mockResolvedValueOnce({ imported: 350, skipped: 150 })
      .mockResolvedValueOnce({ imported: 480, skipped: 20 });

    const response = await POST(jsonRequest({ tweets, users: USERS_OBJ }));

    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      total: 1_500,
      imported: 1_230, // 400 + 350 + 480
      skipped: 270,    // 100 + 150 + 20
      errors: 0,
    });
  });

  it("uses a single batch call when tweet count is below the chunk size", async () => {
    const tweets = makeTweets(42);
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 42, skipped: 0 });

    await POST(jsonRequest({ tweets, users: USERS_OBJ }));

    expect(mockRepo.upsertBookmarksBatch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 9. Partial chunk failure
// ---------------------------------------------------------------------------

describe("POST /api/v1/import — partial chunk failure", () => {
  it("counts failed chunk items as errors and continues processing remaining chunks", async () => {
    const tweets = makeTweets(800); // 2 chunks: 500 + 300
    mockRepo.upsertBookmarksBatch
      .mockResolvedValueOnce({ imported: 450, skipped: 50 })
      .mockRejectedValueOnce(new Error("DB connection lost"));

    const response = await POST(jsonRequest({ tweets, users: USERS_OBJ }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      total: 800,
      imported: 450,
      skipped: 50,
      errors: 300, // second chunk of 300 counted as errors
    });
    expect(mockRepo.upsertBookmarksBatch).toHaveBeenCalledTimes(2);
  });

  it("reports errors from the first chunk and successes from subsequent chunks", async () => {
    const tweets = makeTweets(700); // 2 chunks: 500 + 200
    mockRepo.upsertBookmarksBatch
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ imported: 180, skipped: 20 });

    const response = await POST(jsonRequest({ tweets, users: USERS_OBJ }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      total: 700,
      imported: 180,
      skipped: 20,
      errors: 500,
    });
  });
});

// ---------------------------------------------------------------------------
// 10. Internal server error
// ---------------------------------------------------------------------------

describe("POST /api/v1/import — internal server error", () => {
  it("returns 500 when an unexpected error escapes the request-parsing block", async () => {
    // getRepository() is inside the outer try but outside the inner
    // request-parsing try/catch. Making it throw triggers the 500 path.
    mockGetRepository.mockImplementationOnce(() => {
      throw new Error("DB connection pool exhausted");
    });

    const response = await POST(
      jsonRequest({ tweets: makeTweets(1), users: USERS_OBJ })
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toMatch(/internal server error/i);
  });

  it("returns 400 (not 500) when the JSON body cannot be parsed", async () => {
    // Malformed JSON triggers the inner try/catch which returns a 400
    const badRequest = new Request("http://localhost/api/v1/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ bad json",
    });

    const response = await POST(badRequest);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 11. format and warnings passthrough
// ---------------------------------------------------------------------------

describe("POST /api/v1/import — format and warnings from parser", () => {
  it("returns format and warnings from parseImportFile for raw content input", async () => {
    const warnings = ["Skipped malformed entry at line 42"];
    mockParseImportFile.mockReturnValue({
      tweets: makeTweets(5),
      users: makeUsersMap(),
      format: "twitter-bookmarks",
      warnings,
    });
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 5, skipped: 0 });

    const response = await POST(jsonRequest({ content: "...", filename: "export.json" }));

    const body = await response.json();
    expect(body.format).toBe("twitter-bookmarks");
    expect(body.warnings).toEqual(warnings);
  });

  it("returns format and warnings from parseImportFile for multipart upload", async () => {
    const warnings = ["Unknown media type skipped"];
    mockParseImportFile.mockReturnValue({
      tweets: makeTweets(2),
      users: makeUsersMap(),
      format: "csv",
      warnings,
    });
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 2, skipped: 0 });

    const response = await POST(multipartRequest("export.csv", "id,text\n1,hello"));

    const body = await response.json();
    expect(body.format).toBe("csv");
    expect(body.warnings).toEqual(warnings);
  });

  it("returns undefined format and empty warnings for pre-parsed JSON without format field", async () => {
    mockRepo.upsertBookmarksBatch.mockResolvedValue({ imported: 2, skipped: 0 });

    const response = await POST(jsonRequest({ tweets: makeTweets(2), users: USERS_OBJ }));

    const body = await response.json();
    expect(body.format).toBeUndefined();
    expect(body.warnings).toEqual([]);
  });
});
