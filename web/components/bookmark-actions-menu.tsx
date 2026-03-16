"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { MoveFolderDialog } from "@/components/move-folder-dialog";
import { deleteBookmark } from "@/lib/actions";
import { toast } from "sonner";

interface Folder {
  id: string;
  name: string;
}

export function BookmarkActionsMenu({
  tweetId,
  currentFolderId,
  folders,
  onEditNotes,
}: {
  tweetId: string;
  currentFolderId: string | null;
  folders: Folder[];
  onEditNotes?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleDelete() {
    setShowDeleteConfirm(true);
    return;
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      const result = await deleteBookmark(tweetId);
      if (result.success) {
        toast.success("Bookmark deleted");
      } else {
        toast.error("Failed to delete bookmark");
      }
    } catch {
      toast.error("Failed to delete bookmark");
    } finally {
      setDeleting(false);
    }
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
          <MoveFolderDialog
            tweetId={tweetId}
            currentFolderId={currentFolderId}
            folders={folders}
          >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Move to folder
            </DropdownMenuItem>
          </MoveFolderDialog>
          <DropdownMenuItem
            onSelect={handleDelete}
            disabled={deleting}
            className="text-destructive focus:text-destructive"
          >
            {deleting ? "Deleting..." : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bookmark?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The bookmark will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
