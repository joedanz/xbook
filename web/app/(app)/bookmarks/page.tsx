import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { getRepository } from "@/lib/db";
import type { BookmarkQuery } from "@shared/types";
import { groupByFolder } from "@/lib/bookmark-utils";
import { BookmarkCard } from "@/components/bookmark-card";
import { SearchBar } from "@/components/search-bar";
import { FilterBar } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { SyncButton } from "@/components/sync-button";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export const metadata = { title: "Bookmarks", robots: { index: false } };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BookmarksPage({ searchParams }: PageProps) {
  const { userId } = await requireUser();
  const params = await searchParams;
  const repo = getRepository(userId);
  const filter = typeof params.filter === "string" ? params.filter : undefined;

  const query: BookmarkQuery = {
    search: typeof params.q === "string" ? params.q : undefined,
    folderId: typeof params.folder === "string" ? params.folder : undefined,
    authorUsername:
      typeof params.author === "string" ? params.author : undefined,
    starred: filter === "starred" ? true : undefined,
    needToRead: filter === "need-to-read" ? true : undefined,
    hidden: filter === "hidden" ? true : undefined,
    deleted: filter === "deleted" ? true : undefined,
    orderBy:
      (params.sort as BookmarkQuery["orderBy"]) || "created_at",
    orderDir: "desc",
    page: params.page ? parseInt(String(params.page), 10) : 1,
    pageSize: 20,
  };

  const cols = Math.max(1, Math.min(4, parseInt(String(params.cols ?? "3"), 10) || 3));

  const result = await repo.queryBookmarks(query);
  const folders = await repo.getFolders();
  const authors = await repo.getAuthors();

  const title =
    filter === "starred"
      ? "Starred Bookmarks"
      : filter === "need-to-read"
        ? "Need to Read"
        : filter === "hidden"
          ? "Hidden Bookmarks"
          : filter === "deleted"
            ? "Deleted Bookmarks"
            : "Bookmarks";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SyncButton />
        </div>
      </div>

      <Suspense>
        <div className="space-y-3">
          <SearchBar />
          <FilterBar folders={folders} authors={authors} />
        </div>
      </Suspense>

      {result.items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No bookmarks match your filters.</p>
        </div>
      ) : filter === "need-to-read" ? (
        <div className="space-y-6">
          {groupByFolder(result.items).map(({ folder, items }) => (
            <div key={folder}>
              <h2 className="text-lg font-semibold mb-3">{folder}</h2>
              <div
                className="grid grid-cols-1 md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))] gap-4"
                style={{ "--cols": cols } as React.CSSProperties}
              >
                {items.map((bm) => (
                  <BookmarkCard
                    key={bm.tweet_id}
                    bookmark={bm}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))] gap-4"
          style={{ "--cols": cols } as React.CSSProperties}
        >
          {result.items.map((bm) => (
            <BookmarkCard
              key={bm.tweet_id}
              bookmark={bm}
              isHidden={filter === "hidden"}
              isDeleted={filter === "deleted"}
            />
          ))}
        </div>
      )}

      <Suspense>
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
        />
      </Suspense>
    </div>
  );
}
