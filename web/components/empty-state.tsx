"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ConnectButton } from "@/components/connect-button";
import { Button } from "@/components/ui/button";

export function EmptyState() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/connect-x/status")
      .then((r) => r.json())
      .then((d) => setAuthenticated(d.authenticated))
      .catch(() => {/* leave as null — loading state is safer than wrong state */});
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        router.refresh();
      } else {
        setSyncError(data.message || "Sync failed");
      }
    } catch {
      setSyncError("Sync request failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="text-4xl">📚</div>
          <h2 className="text-xl font-semibold">No bookmarks yet</h2>
          {authenticated === null ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : authenticated ? (
            <>
              <p className="text-muted-foreground text-sm">
                Your X account is connected. Sync your bookmarks to get started.
              </p>
              <Button
                size="lg"
                className="w-full"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
              {syncError && (
                <p className="text-destructive text-sm">{syncError}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                Connect your X account to start syncing your bookmarks.
              </p>
              <ConnectButton />
            </>
          )}
          {!process.env.NEXT_PUBLIC_APP_URL && (
            <div className="text-left bg-muted rounded-lg p-4 font-mono text-sm space-y-1">
              <p className="text-muted-foreground text-xs font-sans mb-2">
                Or use the CLI:
              </p>
              <p>
                <span className="text-muted-foreground">$</span> xbook login
              </p>
              <p>
                <span className="text-muted-foreground">$</span> xbook sync
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
