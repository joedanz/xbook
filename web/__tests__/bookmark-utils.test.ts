import { describe, it, expect } from "vitest";
import { groupByFolder } from "@/lib/bookmark-utils";
import type { StoredBookmark } from "@shared/types";

function makeBookmark(
  overrides: Partial<StoredBookmark> = {}
): StoredBookmark {
  return {
    tweet_id: "t-" + Math.random().toString(36).slice(2, 8),
    text: "Test tweet",
    author_id: null,
    author_name: null,
    author_username: null,
    created_at: null,
    folder_id: null,
    folder_name: null,
    synced_at: "2025-01-01T00:00:00Z",
    newslettered_at: null,
    notes: null,
    tags: null,
    media_url: null,
    url_title: null,
    url_description: null,
    url_image: null,
    expanded_url: null,
    starred: false,
    need_to_read: false,
    hidden: false,
    ...overrides,
  };
}

describe("groupByFolder", () => {
  it("groups bookmarks by folder_name", () => {
    const bookmarks = [
      makeBookmark({ folder_name: "React" }),
      makeBookmark({ folder_name: "React" }),
      makeBookmark({ folder_name: "Go" }),
    ];
    const result = groupByFolder(bookmarks);

    expect(result).toHaveLength(2);
    const reactGroup = result.find((g) => g.folder === "React");
    expect(reactGroup?.items).toHaveLength(2);
    const goGroup = result.find((g) => g.folder === "Go");
    expect(goGroup?.items).toHaveLength(1);
  });

  it('null/missing folder_name grouped as "Unsorted"', () => {
    const bookmarks = [
      makeBookmark({ folder_name: null }),
      makeBookmark({ folder_name: null }),
    ];
    const result = groupByFolder(bookmarks);

    expect(result).toHaveLength(1);
    expect(result[0].folder).toBe("Unsorted");
    expect(result[0].items).toHaveLength(2);
  });

  it('"Unsorted" always sorts last', () => {
    const bookmarks = [
      makeBookmark({ folder_name: null }),
      makeBookmark({ folder_name: "Alpha" }),
      makeBookmark({ folder_name: "Zebra" }),
    ];
    const result = groupByFolder(bookmarks);

    expect(result.map((g) => g.folder)).toEqual([
      "Alpha",
      "Zebra",
      "Unsorted",
    ]);
  });

  it("named folders sort alphabetically", () => {
    const bookmarks = [
      makeBookmark({ folder_name: "TypeScript" }),
      makeBookmark({ folder_name: "Go" }),
      makeBookmark({ folder_name: "React" }),
    ];
    const result = groupByFolder(bookmarks);

    expect(result.map((g) => g.folder)).toEqual(["Go", "React", "TypeScript"]);
  });

  it("empty input returns empty array", () => {
    expect(groupByFolder([])).toEqual([]);
  });
});
