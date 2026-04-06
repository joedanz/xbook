"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const chartConfig = {
  count: {
    label: "Bookmarks",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function FolderChart({
  data,
}: {
  data: { folder: string; count: number }[];
}) {
  const reducedMotion = useReducedMotion();

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Bookmarks by Folder</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            Create folders to see bookmark distribution.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>Bookmarks by Folder</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
          >
            <YAxis
              dataKey="folder"
              type="category"
              tickLine={false}
              axisLine={false}
              width={100}
              tick={{ fontSize: 12 }}
            />
            <XAxis type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={4}
              isAnimationActive={!reducedMotion}
            />
          </BarChart>
        </ChartContainer>
        {/* Hidden table for screen readers */}
        <table className="sr-only">
          <caption>Bookmarks by folder</caption>
          <thead>
            <tr>
              <th>Folder</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.folder}>
                <td>{d.folder}</td>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
