// ABOUTME: Tests for the v1 bookmarks/:id PATCH route handler.
// ABOUTME: Covers validation, auth, and update operations.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

// Mock rate-limit module
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  rateLimitResponse: vi.fn().mockImplementation((rl: { resetAt: number }, message = "Too many requests") =>
    NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } })
  ),
  getClientIp: vi.fn(() => "127.0.0.1"),
  API_RATE_LIMIT: { requests: 60, windowMs: 60000 },
}));

// Mock api-auth module
vi.mock("@/lib/api-auth", () => ({
  authenticateApiRequest: vi.fn(),
}));

// Mock db module
const mockGetBookmarkById = vi.fn();
const mockSetStarred = vi.fn();
const mockSetNeedToRead = vi.fn();
const mockUpdateBookmarkNotes = vi.fn();
const mockAddBookmarkTag = vi.fn();
const mockRemoveBookmarkTag = vi.fn();
const mockMoveBookmarkToFolder = vi.fn();
const mockDeleteBookmark = vi.fn();

vi.mock("@/lib/db", () => ({
  getRepository: vi.fn(() => ({
    getBookmarkById: mockGetBookmarkById,
    setStarred: mockSetStarred,
    setNeedToRead: mockSetNeedToRead,
    updateBookmarkNotes: mockUpdateBookmarkNotes,
    addBookmarkTag: mockAddBookmarkTag,
    removeBookmarkTag: mockRemoveBookmarkTag,
    moveBookmarkToFolder: mockMoveBookmarkToFolder,
    deleteBookmark: mockDeleteBookmark,
  })),
}));

import { PATCH, DELETE } from "../web/app/api/v1/bookmarks/[id]/route";
import { checkRateLimit } from "../web/lib/rate-limit";
import { authenticateApiRequest } from "../web/lib/api-auth";

const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedAuth = vi.mocked(authenticateApiRequest);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: pass rate limit and auth
  mockedCheckRateLimit.mockResolvedValue({ allowed: true, resetAt: 0 });
  mockedAuth.mockResolvedValue({ userId: "local" });
});

function patchRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/v1/bookmarks/bm-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(): Request {
  return new Request("http://localhost:3000/api/v1/bookmarks/bm-1", {
    method: "DELETE",
  });
}

const params = Promise.resolve({ id: "bm-1" });

describe("PATCH /api/v1/bookmarks/:id", () => {
  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost:3000/api/v1/bookmarks/bm-1", {
      method: "PATCH",
      body: "not json",
    });

    const res = await PATCH(req, { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON body");
  });

  it("returns 400 when body is an array", async () => {
    const res = await PATCH(patchRequest([1, 2, 3]), { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("JSON object");
  });

  it("returns 400 when notes is not a string", async () => {
    const res = await PATCH(patchRequest({ notes: 123 }), { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("notes must be a string");
  });

  it("returns 400 when notes exceeds max length", async () => {
    const res = await PATCH(
      patchRequest({ notes: "a".repeat(10001) }),
      { params }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("10000 characters");
  });

  it("returns 400 when add_tags is not an array of strings", async () => {
    const res = await PATCH(patchRequest({ add_tags: "not-array" }), { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("add_tags");
  });

  it("returns 400 when remove_tags contains non-strings", async () => {
    const res = await PATCH(patchRequest({ remove_tags: [1, 2] }), { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("remove_tags");
  });

  it("returns 404 when bookmark does not exist", async () => {
    mockGetBookmarkById.mockResolvedValueOnce(null);
    const res = await PATCH(patchRequest({ starred: true }), { params });
    expect(res.status).toBe(404);
  });

  it("updates starred field on existing bookmark", async () => {
    mockGetBookmarkById.mockResolvedValueOnce({ id: "bm-1" });
    const res = await PATCH(patchRequest({ starred: true }), { params });
    expect(res.status).toBe(200);
    expect(mockSetStarred).toHaveBeenCalledWith("bm-1", true);
  });

  it("updates multiple fields at once", async () => {
    mockGetBookmarkById.mockResolvedValueOnce({ id: "bm-1" });
    const res = await PATCH(
      patchRequest({
        starred: false,
        need_to_read: true,
        notes: "great thread",
        add_tags: ["ai", "ml"],
        remove_tags: ["old"],
        folder_id: "f-1",
        folder_name: "Tech",
      }),
      { params }
    );
    expect(res.status).toBe(200);
    expect(mockSetStarred).toHaveBeenCalledWith("bm-1", false);
    expect(mockSetNeedToRead).toHaveBeenCalledWith("bm-1", true);
    expect(mockUpdateBookmarkNotes).toHaveBeenCalledWith("bm-1", "great thread");
    expect(mockAddBookmarkTag).toHaveBeenCalledTimes(2);
    expect(mockRemoveBookmarkTag).toHaveBeenCalledWith("bm-1", "old");
    expect(mockMoveBookmarkToFolder).toHaveBeenCalledWith("bm-1", "f-1", "Tech");
  });
});

describe("DELETE /api/v1/bookmarks/:id", () => {
  it("returns 404 when bookmark does not exist", async () => {
    mockGetBookmarkById.mockResolvedValueOnce(null);
    const res = await DELETE(deleteRequest(), { params });
    expect(res.status).toBe(404);
  });

  it("deletes existing bookmark", async () => {
    mockGetBookmarkById.mockResolvedValueOnce({ id: "bm-1" });
    const res = await DELETE(deleteRequest(), { params });
    expect(res.status).toBe(200);
    expect(mockDeleteBookmark).toHaveBeenCalledWith("bm-1");
  });
});
