"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConnectButton() {
  const [loading, setLoading] = useState(false);

  return (
    <>
      <Button asChild size="lg" className="w-full" disabled={loading}>
        <a
          href="/api/connect-x"
          onClick={() => setLoading(true)}
          aria-disabled={loading || undefined}
          className={loading ? "pointer-events-none opacity-70" : ""}
        >
          {loading ? "Redirecting..." : "Connect X Account"}
        </a>
      </Button>
      <span aria-live="polite" className="sr-only">
        {loading ? "Redirecting to X for authentication..." : ""}
      </span>
    </>
  );
}
