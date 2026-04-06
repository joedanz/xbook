"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { moveBookmark } from "@/lib/actions";
import { trackMoveBookmark } from "@/lib/analytics";
import { toast } from "sonner";

interface Folder {
  id: string;
  name: string;
}

export function MoveFolderDialog({
  tweetId,
  currentFolderId,
  folders,
  children,
}: {
  tweetId: string;
  currentFolderId: string | null;
  folders: Folder[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);

  async function handleMove(folderId: string | null, folderName: string | null) {
    setMoving(true);
    try {
      const result = await moveBookmark(tweetId, folderId, folderName);
      if (result.success) {
        trackMoveBookmark();
        toast.success(
          folderName ? `Moved to ${folderName}` : "Removed from folder"
        );
        setOpen(false);
      } else {
        toast.error("Failed to move bookmark");
      }
    } catch {
      toast.error("Failed to move bookmark");
    } finally {
      setMoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>Select a destination folder for this bookmark.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Button
            variant={currentFolderId === null ? "secondary" : "ghost"}
            className="justify-start"
            disabled={moving || currentFolderId === null}
            onClick={() => handleMove(null, null)}
          >
            No folder
          </Button>
          {folders.map((f) => (
            <Button
              key={f.id}
              variant={f.id === currentFolderId ? "secondary" : "ghost"}
              className="justify-start"
              disabled={moving || f.id === currentFolderId}
              onClick={() => handleMove(f.id, f.name)}
            >
              {f.name}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
