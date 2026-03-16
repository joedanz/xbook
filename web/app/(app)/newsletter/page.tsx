import { requireUser } from "@/lib/session";
import { getRepository } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FormattedDate } from "@/components/formatted-date";
import { NewsletterActions } from "./newsletter-actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Newsletter", robots: { index: false } };

export default async function NewsletterPage() {
  const { userId } = await requireUser();
  const repo = getRepository();
  const stats = await repo.getStats();
  const history = await repo.getNewsletterHistory(10);
  const pendingBookmarks = await repo.getNewBookmarks();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Newsletter</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {process.env.RESEND_API_KEY ? "Enabled" : "Not configured"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Frequency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">Weekly (cron)</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Sent</CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle>Send Newsletter</CardTitle>
          <CardDescription>
            {pendingBookmarks.length} new bookmark
            {pendingBookmarks.length !== 1 ? "s" : ""} since last newsletter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewsletterActions hasBookmarks={pendingBookmarks.length > 0} />
        </CardContent>
      </Card>

      {history.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold mb-3">Send History</h2>
            <div className="space-y-2">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-0.5"
                >
                  <FormattedDate date={entry.sent_at} format="datetime" className="text-muted-foreground" />
                  <span>{entry.bookmark_count} bookmarks</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
