"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  sendNewsletter,
  previewNewsletter,
  getNewsletterBookmarkCount,
} from "@/lib/actions";
import { trackSendNewsletter } from "@/lib/analytics";
import type { NewsletterDateRange } from "@shared/types";

type RangeMode = NewsletterDateRange["mode"];
const MODES: { value: RangeMode; label: string }[] = [
  { value: "all_unsent", label: "All Unsent" },
  { value: "since_last_send", label: "Since Last Send" },
  { value: "last_n_weeks", label: "Last N Weeks" },
  { value: "custom", label: "Custom Range" },
];

const MAX_INCLUDED = 100; // matches MAX_BOOKMARKS in renderer

function CountStatus({ loading, error, count }: { loading: boolean; error: boolean; count: number }): React.ReactNode {
  if (loading) return "Loading bookmark count...";
  if (error) return "Unable to load count";
  const plural = count !== 1;
  const label = `${count} bookmark${plural ? "s" : ""} match${plural ? "" : "es"}`;
  if (count > MAX_INCLUDED) {
    return `${label} (${MAX_INCLUDED} will be included)`;
  }
  return label;
}

export function NewsletterActions({
  initialCount,
  lastSendDate,
}: {
  initialCount: number;
  lastSendDate: string | null;
}) {
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [includeImages, setIncludeImages] = useState(true);
  const [starredOnly, setStarredOnly] = useState(false);
  const [mustReadOnly, setMustReadOnly] = useState(false);

  // Date range state
  const [rangeMode, setRangeMode] = useState<RangeMode>("all_unsent");
  const [weeks, setWeeks] = useState<1 | 2 | 3 | 4>(2);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [includePreviouslySent, setIncludePreviouslySent] = useState(false);

  // Dynamic bookmark count
  const [bookmarkCount, setBookmarkCount] = useState(initialCount);
  const [countLoading, setCountLoading] = useState(false);
  const [countError, setCountError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Validation
  const customDateInvalid =
    rangeMode === "custom" &&
    startDate &&
    endDate &&
    new Date(endDate) < new Date(startDate);

  function buildDateRange(): NewsletterDateRange | undefined {
    switch (rangeMode) {
      case "all_unsent":
        return { mode: "all_unsent" };
      case "since_last_send":
        return { mode: "since_last_send", includePreviouslySent };
      case "last_n_weeks":
        return { mode: "last_n_weeks", weeks, includePreviouslySent };
      case "custom":
        if (!startDate || !endDate) return undefined;
        return { mode: "custom", startDate, endDate, includePreviouslySent };
      default:
        return undefined;
    }
  }

  const fetchCount = useCallback(async () => {
    const dateRange = buildDateRange();
    if (rangeMode === "custom" && (!startDate || !endDate || customDateInvalid)) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCountLoading(true);
    setCountError(false);
    try {
      const result = await getNewsletterBookmarkCount({ dateRange, starredOnly, mustReadOnly });
      if (controller.signal.aborted) return;
      if (result.success) {
        setBookmarkCount(result.count);
      } else {
        setCountError(true);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error("Failed to fetch bookmark count:", err);
        setCountError(true);
      }
    } finally {
      if (!controller.signal.aborted) {
        setCountLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeMode, weeks, startDate, endDate, includePreviouslySent, starredOnly, mustReadOnly, customDateInvalid]);

  // Fetch bookmark count: immediate for preset modes, debounced for custom dates
  useEffect(() => {
    if (rangeMode === "custom" && (!startDate || !endDate || customDateInvalid)) {
      return;
    }

    const isCustom = rangeMode === "custom";
    if (!isCustom) {
      fetchCount();
      return;
    }

    const timer = setTimeout(() => fetchCount(), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeMode, weeks, startDate, endDate, includePreviouslySent, starredOnly, mustReadOnly, customDateInvalid]);

  // Preview blob URL lifecycle
  useEffect(() => {
    if (!previewHtml) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(
      new Blob([previewHtml], { type: "text/html" })
    );
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewHtml]);

  const canSend = bookmarkCount > 0 && !customDateInvalid;

  async function handleSend() {
    const dateRange = buildDateRange();
    if (rangeMode === "custom" && !dateRange) return;
    setSending(true);
    try {
      const data = await sendNewsletter({
        includeImages,
        dateRange,
        starredOnly,
        mustReadOnly,
      });
      if (data.success) {
        trackSendNewsletter();
        toast.success(data.message);
        // Re-fetch count (may not be 0 if includePreviouslySent was on)
        fetchCount();
      } else {
        toast.error(data.error || "Failed to send newsletter");
      }
    } catch (err) {
      console.error("Newsletter send failed:", err);
      toast.error("Request failed");
    } finally {
      setSending(false);
    }
  }

  async function handlePreview() {
    const dateRange = buildDateRange();
    if (rangeMode === "custom" && !dateRange) return;
    setPreviewing(true);
    try {
      const data = await previewNewsletter({
        includeImages,
        dateRange,
        starredOnly,
        mustReadOnly,
      });
      if (data.success) {
        setPreviewHtml(data.html ?? null);
        toast.success(`Preview: ${data.count} bookmarks`);
      } else {
        toast.error(data.error || "Failed to preview");
      }
    } catch (err) {
      console.error("Newsletter preview failed:", err);
      toast.error("Request failed");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Date range segmented control */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Date Range
        </label>
        <div
          className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden"
          role="radiogroup"
          aria-label="Newsletter date range"
        >
          {MODES.map((m) => (
            <button
              key={m.value}
              role="radio"
              aria-checked={rangeMode === m.value}
              className={`px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                rangeMode === m.value
                  ? "bg-blue-500 text-white"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              } border-r border-gray-200 dark:border-gray-700 last:border-r-0`}
              onClick={() => setRangeMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-options for last_n_weeks */}
      {rangeMode === "last_n_weeks" && (
        <div className="flex items-center gap-2">
          <label className="text-sm" htmlFor="weeks-select">
            Weeks:
          </label>
          <select
            id="weeks-select"
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value) as 1 | 2 | 3 | 4)}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
          >
            <option value={1}>1 week</option>
            <option value={2}>2 weeks</option>
            <option value={3}>3 weeks</option>
            <option value={4}>4 weeks</option>
          </select>
        </div>
      )}

      {/* Sub-options for custom range */}
      {rangeMode === "custom" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm w-12" htmlFor="start-date">
              From:
            </label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm w-12" htmlFor="end-date">
              To:
            </label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-44"
            />
          </div>
          {customDateInvalid && (
            <p className="text-sm text-red-500">
              End date must be on or after start date
            </p>
          )}
        </div>
      )}

      {/* Include previously sent (disabled for all_unsent) */}
      {rangeMode !== "all_unsent" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includePreviouslySent}
            onChange={(e) => setIncludePreviouslySent(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
          />
          Include previously sent bookmarks
        </label>
      )}

      {/* Content filters */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={starredOnly}
          onChange={(e) => setStarredOnly(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
        />
        Starred only
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={mustReadOnly}
          onChange={(e) => setMustReadOnly(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
        />
        Must read only
      </label>

      {/* Visual separator before formatting options */}
      <div className="border-t border-gray-200 dark:border-gray-700" />

      {/* Include images */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeImages}
          onChange={(e) => setIncludeImages(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
        />
        Include images in email
      </label>

      {/* Bookmark count info */}
      <div className="text-sm text-muted-foreground" aria-live="polite">
        <CountStatus loading={countLoading} error={countError} count={bookmarkCount} />
        {rangeMode === "since_last_send" && !lastSendDate && (
          <span className="ml-1">(no prior send — showing all unsent)</span>
        )}
        {bookmarkCount === 0 && !countLoading && !countError && (starredOnly || mustReadOnly) && (
          <p className="text-xs text-muted-foreground mt-1">
            Try unchecking Starred only or Must read only
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleSend}
          disabled={sending || !canSend}
          size="sm"
        >
          {sending ? "Sending..." : "Send Now"}
        </Button>
        <Button
          variant="outline"
          onClick={handlePreview}
          disabled={previewing || !canSend}
          size="sm"
        >
          {previewing ? "Loading..." : "Preview"}
        </Button>
      </div>

      {previewUrl && (
        <div className="border rounded-md overflow-auto max-h-[500px]">
          <iframe
            src={previewUrl}
            title="Newsletter preview"
            className="w-full min-h-[400px] border-0"
            sandbox=""
          />
        </div>
      )}
    </div>
  );
}
