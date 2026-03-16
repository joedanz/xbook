"use client";

import { useState, useRef, useEffect } from "react";
import { updateNotes } from "@/lib/actions";
import { toast } from "sonner";

export function NoteEditor({
  tweetId,
  initialNotes,
}: {
  tweetId: string;
  initialNotes: string | null;
}) {
  const [isMac, setIsMac] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const escapedRef = useRef(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  async function save() {
    setSaving(true);
    try {
      await updateNotes(tweetId, notes);
      setEditing(false);
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") {
      escapedRef.current = true;
      setNotes(initialNotes || "");
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        aria-label="Add a note to this bookmark"
        className="text-xs text-muted-foreground hover:text-foreground text-left"
      >
        {initialNotes ? (
          <span className="italic">Note: {initialNotes}</span>
        ) : (
          <span className="hover:underline">+ Add note</span>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <textarea
        ref={textareaRef}
        aria-label="Bookmark note"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!escapedRef.current) save();
          escapedRef.current = false;
        }}
        disabled={saving}
        rows={2}
        className="w-full text-xs border rounded px-2 py-1 resize-none bg-background"
        placeholder="Add a note..."
      />
      <p className="text-[10px] text-muted-foreground">
        {isMac ? "⌘" : "Ctrl"}+Enter to save · Esc to cancel
      </p>
    </div>
  );
}
