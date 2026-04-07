"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ConnectButton } from "@/components/connect-button";
import { Button } from "@/components/ui/button";
import { SyncProgressModal } from "@/components/sync-progress-modal";

export function EmptyState() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [expired, setExpired] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch("/api/connect-x/status")
      .then((r) => r.json())
      .then((d) => {
        setAuthenticated(d.authenticated);
        setExpired(!!d.expired);
      })
      .catch(() => {/* leave as null — loading state is safer than wrong state */});
  }, []);

  const needsReconnect = authenticated && expired;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="text-4xl">📚</div>
          <h2 className="text-xl font-semibold">No bookmarks yet</h2>
          {authenticated === null ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : needsReconnect ? (
            <>
              <p className="text-muted-foreground text-sm">
                Your X session has expired. Re-connect your account to sync bookmarks.
              </p>
              <ConnectButton />
            </>
          ) : authenticated ? (
            <>
              <p className="text-muted-foreground text-sm">
                Your X account is connected. Sync your bookmarks to get started.
              </p>
              <Button
                size="lg"
                className="w-full"
                onClick={() => setShowModal(true)}
                disabled={showModal}
              >
                {showModal ? "Syncing..." : "Sync Now"}
              </Button>
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
                <span className="text-muted-foreground">$</span> xbook sync
                --chrome
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <SyncProgressModal open={showModal} onOpenChange={setShowModal} />
    </div>
  );
}
