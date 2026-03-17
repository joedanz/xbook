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
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SyncProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SyncStatus = "syncing" | "done" | "error";

export function SyncProgressModal({ open, onOpenChange }: SyncProgressModalProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus>("syncing");
  const [lines, setLines] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startSync = useCallback(async () => {
    setStatus("syncing");
    setLines([]);
    setSummary("");

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
            setLines((prev) => [...prev, data.message]);
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
  useEffect(() => {
    if (open) {
      startSync();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [open, startSync]);

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
