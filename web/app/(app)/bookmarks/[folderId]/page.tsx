import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getRepository } from "@/lib/db";
import type { BookmarkQuery } from "@shared/types";
import { BookmarkCard } from "@/components/bookmark-card";
import { SearchBar } from "@/components/search-bar";
import { FilterBar } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { userId } = await requireUser();
  const { folderId } = await params;
  const repo = getRepository(userId);
  const folders = await repo.getFolders();
  const folder = folders.find((f) => f.id === folderId);
  return {
    title: folder ? folder.name : "Folder",
    robots: { index: false },
  };
}

interface PageProps {
  params: Promise<{ folderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FolderPage({ params, searchParams }: PageProps) {
  const { userId } = await requireUser();
  const { folderId } = await params;
  const sp = await searchParams;
  const repo = getRepository(userId);

  // Find folder name
  const folders = await repo.getFolders();
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) notFound();

  const cols = Math.max(1, Math.min(4, parseInt(String(sp.cols ?? "3"), 10) || 3));
  const filter = typeof sp.filter === "string" ? sp.filter : undefined;

  const query: BookmarkQuery = {
    folderId,
    search: typeof sp.q === "string" ? sp.q : undefined,
    authorUsername: typeof sp.author === "string" ? sp.author : undefined,
    starred: filter === "starred" ? true : undefined,
    needToRead: filter === "need-to-read" ? true : undefined,
    orderBy: (sp.sort as BookmarkQuery["orderBy"]) || "created_at",
    orderDir: "desc",
    page: sp.page ? parseInt(String(sp.page), 10) : 1,
    pageSize: 20,
  };

  const result = await repo.queryBookmarks(query);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{folder.name}</h1>
      <p className="text-muted-foreground text-sm">
        {result.total} bookmark{result.total !== 1 ? "s" : ""} in this folder
      </p>

      <Suspense>
        <div className="space-y-3">
          <SearchBar />
          <FilterBar />
        </div>
      </Suspense>

      {result.items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No bookmarks match your filters.</p>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))] gap-4"
          style={{ "--cols": cols } as React.CSSProperties}
        >
          {result.items.map((bm) => (
            <BookmarkCard key={bm.tweet_id} bookmark={bm} folders={folders} />
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
