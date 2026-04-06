import type { SyncLogEntry } from "@shared/types";
import { FolderChart } from "./folder-chart";
import { SyncHistoryChart } from "./sync-history-chart";

export function AnalyticsCharts({
  bookmarksByFolder,
  syncHistory,
}: {
  bookmarksByFolder: { folder: string; count: number }[];
  syncHistory: SyncLogEntry[];
}) {
  return (
    <section aria-labelledby="analytics-heading">
      <h2 id="analytics-heading" className="sr-only">
        Collection Insights
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FolderChart data={bookmarksByFolder} />
        <SyncHistoryChart data={syncHistory} />
      </div>
    </section>
  );
}
