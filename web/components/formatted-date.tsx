"use client";
// ABOUTME: Client-only date formatting component to prevent hydration mismatches.
// ABOUTME: Renders a placeholder on server, then formats in user's timezone on client.

import { useSyncExternalStore } from "react";

function formatDateStr(date: string, format: "short" | "long" | "datetime"): string {
  const d = new Date(
    date.endsWith("Z") || date.includes("+") ? date : date + "Z"
  );
  if (isNaN(d.getTime())) return "\u2014";

  const options: Intl.DateTimeFormatOptions =
    format === "long"
      ? { year: "numeric", month: "long", day: "numeric" }
      : format === "datetime"
        ? {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }
        : { year: "numeric", month: "short", day: "numeric" };

  return d.toLocaleDateString("en-US", options);
}

const subscribe = () => () => {};

export function FormattedDate({
  date,
  format = "short",
  className,
}: {
  date: string | null | undefined;
  format?: "short" | "long" | "datetime";
  className?: string;
}) {
  const formatted = useSyncExternalStore(
    subscribe,
    () => (date ? formatDateStr(date, format) : ""),
    () => ""
  );

  if (!date) return null;
  return (
    <time dateTime={date} className={className} suppressHydrationWarning>
      {formatted || "\u2014"}
    </time>
  );
}
