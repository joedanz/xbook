"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectButton } from "@/components/connect-button";

export function ConnectionStatus() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const isCloud = !!process.env.NEXT_PUBLIC_APP_URL;

  useEffect(() => {
    fetch("/api/connect-x/status")
      .then((r) => r.json())
      .then((d) => setAuthenticated(d.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) {
    return <Skeleton className="h-6 w-28" />;
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={authenticated ? "default" : "secondary"}>
        {authenticated ? "Connected" : "Not connected"}
      </Badge>
      {!authenticated && (
        isCloud ? (
          <ConnectButton />
        ) : (
          <p className="text-sm text-muted-foreground">
            Use <code className="font-mono text-xs">xbook login</code> to connect
            your X account.
          </p>
        )
      )}
    </div>
  );
}
