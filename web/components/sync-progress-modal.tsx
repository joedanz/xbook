// ABOUTME: Modal dialog showing real-time sync progress via SSE.
// ABOUTME: Used by SyncButton and EmptyState to stream sync log lines from the server.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SyncProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SyncStatus = "syncing" | "done" | "error";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export function SyncProgressModal({ open, onOpenChange }: SyncProgressModalProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus>("syncing");
  const [lines, setLines] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [rateLimitEnd, setRateLimitEnd] = useState<number | null>(null);
  const [rateLimitAttempt, setRateLimitAttempt] = useState("");
  const [countdown, setCountdown] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startSync = useCallback(async () => {
    setStatus("syncing");
    setLines([]);
    setSummary("");
    setRateLimitEnd(null);
    setRateLimitAttempt("");
    setCountdown(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Sync failed" }));
        setStatus("error");
        setSummary(data.message || "Sync failed");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setStatus("error");
        setSummary("No response stream");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const eventMatch = part.match(/^event: (\w+)/m);
          const dataMatch = part.match(/^data: (.+)/m);
          if (!eventMatch || !dataMatch) continue;

          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (event === "progress") {
            setRateLimitEnd(null);
            setLines((prev) => [...prev, data.message]);
          } else if (event === "ratelimit") {
            setRateLimitEnd(Date.now() + data.waitSeconds * 1000);
            setRateLimitAttempt(`Attempt ${data.attempt} of ${data.maxRetries}`);
            setLines((prev) => [...prev, `Rate limited. Waiting ~${Math.ceil(data.waitSeconds / 60)}m ${data.waitSeconds % 60}s (attempt ${data.attempt}/${data.maxRetries})...`]);
          } else if (event === "done") {
            setStatus("done");
            setSummary(data.message);
            toast.success(data.message);
          } else if (event === "error") {
            setStatus("error");
            setSummary(data.message);
            toast.error(data.message);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("error");
      setSummary("Sync request failed");
    }
  }, []);

  // Start sync when modal opens
  // eslint-disable-next-line react-compiler/react-compiler -- async operation trigger
  useEffect(() => {
    if (open) {
      startSync();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [open, startSync]);

  // Countdown timer for rate limit
  // eslint-disable-next-line react-compiler/react-compiler -- countdown reset is intentional
  useEffect(() => {
    if (!rateLimitEnd) {
      setCountdown(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((rateLimitEnd - Date.now()) / 1000));
      setCountdown(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [rateLimitEnd]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines]);

  // Auto-close after 2 seconds on success
  useEffect(() => {
    if (status !== "done") return;
    const timer = setTimeout(() => {
      onOpenChange(false);
      router.refresh();
    }, 2000);
    return () => clearTimeout(timer);
  }, [status, onOpenChange, router]);

  function handleClose() {
    abortRef.current?.abort();
    onOpenChange(false);
    if (status === "done") {
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent showCloseButton={status !== "syncing"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === "syncing" && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {status === "done" && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            {status === "error" && (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            {status === "syncing" ? "Syncing bookmarks..." : status === "done" ? "Sync complete" : "Sync failed"}
          </DialogTitle>
          {summary && (
            <DialogDescription>{summary}</DialogDescription>
          )}
        </DialogHeader>

        {countdown > 0 && (
          <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
            <Timer className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Rate limited by X API
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Retrying in {formatCountdown(countdown)} &middot; {rateLimitAttempt}
              </p>
            </div>
          </div>
        )}

        <div
          ref={logRef}
          className="bg-muted rounded-md p-3 font-mono text-xs leading-relaxed max-h-64 overflow-y-auto"
        >
          {lines.length === 0 && status === "syncing" && (
            <span className="text-muted-foreground">Connecting to X API...</span>
          )}
          {lines.map((line, i) => (
            <div key={i} className="text-muted-foreground">
              {line}
            </div>
          ))}
        </div>

        {status === "error" && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
