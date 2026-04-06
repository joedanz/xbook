"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function ConnectionStatus() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

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
    <div className="flex items-center gap-3">
      <Badge variant={authenticated ? "default" : "secondary"}>
        {authenticated ? "Connected" : "Not connected"}
      </Badge>
      {!authenticated && (
        <Button asChild size="sm">
          <a href="/api/connect-x">Connect X Account</a>
        </Button>
      )}
    </div>
  );
}
