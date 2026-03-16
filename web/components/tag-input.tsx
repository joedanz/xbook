"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { addTag, removeTag } from "@/lib/actions";
import { toast } from "sonner";

export function TagInput({
  tweetId,
  initialTags,
}: {
  tweetId: string;
  initialTags: string[];
}) {
  const [tags, setTags] = useState(initialTags);
  const [input, setInput] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const tag = input.trim().toLowerCase();
    if (!tag || tags.includes(tag)) {
      setInput("");
      return;
    }
    setPending(true);
    try {
      const result = await addTag(tweetId, tag);
      if (result.success) {
        setTags([...tags, tag]);
        setInput("");
      } else {
        toast.error("Failed to add tag");
      }
    } finally {
      setPending(false);
    }
  }

  async function handleRemove(tag: string) {
    setPending(true);
    try {
      const result = await removeTag(tweetId, tag);
      if (result.success) {
        setTags(tags.filter((t) => t !== tag));
      } else {
        toast.error("Failed to remove tag");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          aria-label={`Remove tag ${tag}`}
          tabIndex={0}
          disabled={pending}
          onClick={() => handleRemove(tag)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleRemove(tag);
            }
          }}
          className="inline-flex items-center focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-sm"
        >
          <Badge
            variant="secondary"
            className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
          >
            {tag} ×
          </Badge>
        </button>
      ))}
      {showInput ? (
        <form onSubmit={handleAdd} className="inline-flex">
          <Input
            aria-label="Add tag"
            value={input}
            disabled={pending}
            onChange={(e) => setInput(e.target.value)}
            onBlur={() => {
              if (!input.trim()) setShowInput(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setInput("");
                setShowInput(false);
              }
            }}
            placeholder="tag..."
            className="h-7 w-20 text-xs px-1"
            autoFocus
          />
        </form>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          + tag
        </button>
      )}
    </div>
  );
}
