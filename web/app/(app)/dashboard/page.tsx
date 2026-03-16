import { SafeImage } from "@/components/safe-image";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getRepository } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/empty-state";
import { SyncButton } from "@/components/sync-button";
import { FormattedDate } from "@/components/formatted-date";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const { userId } = await requireUser();
  const repo = getRepository();
  const stats = await repo.getStats();
  const recentBookmarks = await repo.queryBookmarks({
    page: 1,
    pageSize: 6,
    orderBy: "synced_at",
    orderDir: "desc",
  });
  const syncHistory = await repo.getSyncHistory(3);

  if (stats.totalBookmarks === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <SyncButton />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bookmarks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookmarks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Folders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.folderCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Sync</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {stats.lastSyncAt
                ? <FormattedDate date={stats.lastSyncAt} />
                : "Never"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Newsletter</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {stats.lastNewsletterAt
                ? <FormattedDate date={stats.lastNewsletterAt} />
                : "Never"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookmarks by folder */}
      {stats.bookmarksByFolder.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By Folder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.bookmarksByFolder.map((f) => (
                <div
                  key={f.folder}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm">{f.folder}</span>
                  <Badge variant="secondary">{f.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Recent bookmarks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Bookmarks</h2>
          <Link
            href="/bookmarks"
            className="text-sm text-muted-foreground hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recentBookmarks.items.map((bm) => (
            <Card key={bm.tweet_id} className="overflow-hidden flex flex-col">
              {(bm.media_url || bm.url_image) && (
                <a
                  href={bm.expanded_url || `https://x.com/${bm.author_username || "i"}/status/${bm.tweet_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={bm.url_title || `View bookmark by ${bm.author_name || "unknown"}`}
                  className="relative block aspect-video"
                >
                  <SafeImage
                    src={bm.media_url || bm.url_image!}
                    alt={`${bm.author_name || bm.author_username || "Unknown"}: ${bm.text?.substring(0, 100) || bm.url_title || "bookmark"}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover"
                  />
                </a>
              )}
              <CardContent className="pt-3 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-sm">
                    {bm.author_name || "Unknown"}
                  </span>
                  {bm.author_username && (
                    <span className="text-muted-foreground text-xs">
                      @{bm.author_username}
                    </span>
                  )}
                </div>
                {bm.url_title ? (
                  <p className="text-sm font-medium line-clamp-2 flex-1">
                    {bm.url_title}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
                    {bm.text}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {bm.folder_name && (
                    <Badge variant="outline" className="text-xs">
                      {bm.folder_name}
                    </Badge>
                  )}
                  <a
                    href={`https://x.com/${bm.author_username || "i"}/status/${bm.tweet_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View bookmark by ${bm.author_name || bm.author_username || "unknown"} on X`}
                    className="text-xs text-blue-500 hover:underline ml-auto"
                  >
                    View on X<span className="sr-only"> (opens in new tab)</span>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Sync history */}
      {syncHistory.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold mb-3">Sync History</h2>
            <div className="space-y-2">
              {syncHistory.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-0.5"
                >
                  <FormattedDate date={s.synced_at} format="datetime" className="text-muted-foreground" />
                  <span>
                    {s.bookmarks_fetched} fetched, {s.bookmarks_new} new
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
