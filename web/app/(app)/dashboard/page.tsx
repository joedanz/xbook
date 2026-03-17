import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getRepository } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/empty-state";
import { SyncButton } from "@/components/sync-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { FormattedDate } from "@/components/formatted-date";
import { BookmarkCard } from "@/components/bookmark-card";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const { userId } = await requireUser();
  const repo = getRepository(userId);
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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SyncButton />
        </div>
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
            <BookmarkCard key={bm.tweet_id} bookmark={bm} />
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
