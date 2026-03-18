"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { hideBookmark, unhideBookmark } from "@/lib/actions";
import { toast } from "sonner";

export function BookmarkActionsMenu({
  tweetId,
  onEditNotes,
  isHidden,
}: {
  tweetId: string;
  onEditNotes?: () => void;
  isHidden?: boolean;
}) {
  const [pending, setPending] = useState(false);

  async function handleToggleHidden() {
    setPending(true);
    try {
      if (isHidden) {
        const result = await unhideBookmark(tweetId);
        if (result.success) {
          toast.success("Bookmark unhidden");
        } else {
          toast.error("Failed to unhide bookmark");
        }
      } else {
        const result = await hideBookmark(tweetId);
        if (result.success) {
          toast.success("Bookmark hidden");
        } else {
          toast.error("Failed to hide bookmark");
        }
      }
    } catch {
      toast.error(isHidden ? "Failed to unhide bookmark" : "Failed to hide bookmark");
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Bookmark actions">
          ⋯
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEditNotes && (
          <DropdownMenuItem onSelect={onEditNotes}>
            Edit notes
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={handleToggleHidden}
          disabled={pending}
        >
          {pending
            ? isHidden ? "Unhiding..." : "Hiding..."
            : isHidden ? "Unhide" : "Hide"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
