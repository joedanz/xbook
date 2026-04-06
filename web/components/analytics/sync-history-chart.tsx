"use client";

import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { SyncLogEntry } from "@shared/types";

const chartConfig = {
  bookmarks_fetched: {
    label: "Fetched",
    color: "var(--chart-2)",
  },
  bookmarks_new: {
    label: "New",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

function formatDate(iso: string): string {
  const normalized = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SyncHistoryChart({ data }: { data: SyncLogEntry[] }) {
  const reducedMotion = useReducedMotion();

  if (data.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Sync History</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            Sync history will populate as you sync over time.
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = Array.from({ length: data.length }, (_, i) => {
    const s = data[data.length - 1 - i];
    return { ...s, label: formatDate(s.synced_at) };
  });

  return (
    <Card>
      <CardHeader>
        <CardDescription>Sync History</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart
            data={chartData}
            margin={{ left: 0, right: 16, top: 8, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="bookmarks_fetched"
              type="monotone"
              stroke="var(--color-bookmarks_fetched)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={!reducedMotion}
            />
            <Line
              dataKey="bookmarks_new"
              type="monotone"
              stroke="var(--color-bookmarks_new)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={!reducedMotion}
            />
          </LineChart>
        </ChartContainer>
        {/* Hidden table for screen readers */}
        <table className="sr-only">
          <caption>Sync history</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Fetched</th>
              <th>New</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((d) => (
              <tr key={d.id}>
                <td>{d.label}</td>
                <td>{d.bookmarks_fetched}</td>
                <td>{d.bookmarks_new}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
