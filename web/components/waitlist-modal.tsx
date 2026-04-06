"use client";

// ABOUTME: Modal for capturing waitlist email signups.
// ABOUTME: Handles idle, loading, success, and error states inline.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type State = "idle" | "loading" | "success" | "error";

export function WaitlistModal({ open, onOpenChange }: WaitlistModalProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        setState("error");
        return;
      }

      setState("success");
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setState("error");
    }
  }

  function handleOpenChange(open: boolean) {
    // Reset state when closing so the modal is fresh next time
    if (!open) {
      setState("idle");
      setEmail("");
      setErrorMessage("");
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {state === "success" ? (
          <>
            <DialogHeader>
              <DialogTitle>You&rsquo;re on the list!</DialogTitle>
              <DialogDescription>
                We&rsquo;ll email you when xbook Cloud launches. Keep an eye on
                your inbox.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Join the waitlist</DialogTitle>
              <DialogDescription>
                Be the first to know when xbook Cloud launches. No spam —
                one email when it&rsquo;s ready.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-3 py-2">
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (state === "error") {
                      setState("idle");
                      setErrorMessage("");
                    }
                  }}
                  disabled={state === "loading"}
                  aria-invalid={state === "error" || undefined}
                  aria-describedby={state === "error" ? "waitlist-error" : undefined}
                  required
                />
                {state === "error" && (
                  <p id="waitlist-error" role="alert" className="text-sm text-destructive">
                    {errorMessage}
                  </p>
                )}
              </div>
              <DialogFooter className="mt-2">
                <Button
                  type="submit"
                  disabled={state === "loading"}
                  className="w-full sm:w-auto"
                >
                  {state === "loading" && (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {state === "loading" ? "Joining…" : "Join Waitlist"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
