"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SyncButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  async function handleSync() {
    setSyncing(true);
    setStatusMessage("Syncing bookmarks...");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);
    try {
      const res = await fetch("/api/sync", { method: "POST", signal: controller.signal });
      const data = await res.json();
      if (data.success) {
        setStatusMessage(data.message || "Sync complete");
        toast.success(data.message);
        router.refresh();
      } else {
        setStatusMessage(data.message || "Sync failed");
        toast.error(data.message);
      }
    } catch (err) {
      const message = err instanceof DOMException && err.name === "AbortError"
        ? "Sync timed out — please try again"
        : "Sync request failed";
      setStatusMessage(message);
      toast.error(message);
    } finally {
      clearTimeout(timeout);
      setSyncing(false);
    }
  }

  return (
    <>
      <Button onClick={handleSync} disabled={syncing} size="sm">
        {syncing ? "Syncing..." : "Sync Now"}
      </Button>
      <span aria-live="polite" className="sr-only">{statusMessage}</span>
    </>
  );
}
