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
import { AnalyticsCharts } from "@/components/analytics/analytics-charts";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const { userId } = await requireUser();
  const repo = getRepository(userId);
  const [stats, recentBookmarks, syncHistory] = await Promise.all([
    repo.getStats(),
    repo.queryBookmarks({
      page: 1,
      pageSize: 6,
      orderBy: "synced_at",
      orderDir: "desc",
    }),
    repo.getSyncHistory(20),
  ]);

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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bookmarks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{stats.totalBookmarks}</div>
            {stats.bookmarksThisWeek > 0 && (
              <p className="text-xs text-muted-foreground">+{stats.bookmarksThisWeek} this week</p>
            )}
          </CardContent>
        </Card>
        <Link href="/bookmarks?filter=need-to-read" className="group">
          <Card className="h-full transition-colors group-hover:bg-accent/50">
            <CardHeader className="pb-2">
              <CardDescription>To Read</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{stats.needToReadCount}</div>
            </CardContent>
          </Card>
        </Link>
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

      {(stats.bookmarksByFolder.length > 0 || syncHistory.length >= 2) && (
        <>
          <Separator />
          <AnalyticsCharts
            bookmarksByFolder={stats.bookmarksByFolder}
            syncHistory={syncHistory}
          />
        </>
      )}

      <Separator />

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
    </div>
  );
}
