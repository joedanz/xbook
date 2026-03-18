"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { hideBookmark, unhideBookmark, deleteBookmark, undeleteBookmark } from "@/lib/actions";
import { toast } from "sonner";

export function BookmarkActionsMenu({
  tweetId,
  onEditNotes,
  isHidden,
  isDeleted,
}: {
  tweetId: string;
  onEditNotes?: () => void;
  isHidden?: boolean;
  isDeleted?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleToggleHidden() {
    setPending(true);
    try {
      if (isHidden) {
        const result = await unhideBookmark(tweetId);
        toast[result.success ? "success" : "error"](
          result.success ? "Bookmark unhidden" : "Failed to unhide bookmark"
        );
      } else {
        const result = await hideBookmark(tweetId);
        toast[result.success ? "success" : "error"](
          result.success ? "Bookmark hidden" : "Failed to hide bookmark"
        );
      }
    } catch {
      toast.error(isHidden ? "Failed to unhide bookmark" : "Failed to hide bookmark");
    } finally {
      setPending(false);
    }
  }

  async function handleConfirmDelete() {
    setPending(true);
    try {
      const result = await deleteBookmark(tweetId);
      toast[result.success ? "success" : "error"](
        result.success ? "Bookmark deleted" : "Failed to delete bookmark"
      );
    } catch {
      toast.error("Failed to delete bookmark");
    } finally {
      setPending(false);
    }
  }

  async function handleRestore() {
    setPending(true);
    try {
      const result = await undeleteBookmark(tweetId);
      toast[result.success ? "success" : "error"](
        result.success ? "Bookmark restored" : "Failed to restore bookmark"
      );
    } catch {
      toast.error("Failed to restore bookmark");
    } finally {
      setPending(false);
    }
  }

  if (isDeleted) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Bookmark actions">
            ⋯
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleRestore} disabled={pending}>
            {pending ? "Restoring..." : "Restore"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setShowDeleteConfirm(true)}
            disabled={pending}
            className="text-destructive focus:text-destructive"
          >
            {pending ? "Deleting..." : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bookmark?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the bookmark from all views and prevents it from reappearing on sync. You can restore it later from the Deleted section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={pending}>
              {pending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
