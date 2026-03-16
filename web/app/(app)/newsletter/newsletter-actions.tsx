"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sendNewsletter, previewNewsletter } from "@/lib/actions";

export function NewsletterActions({
  hasBookmarks,
}: {
  hasBookmarks: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!previewHtml) return null;
    return URL.createObjectURL(new Blob([previewHtml], { type: "text/html" }));
  }, [previewHtml]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleSend() {
    setSending(true);
    try {
      const data = await sendNewsletter();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error || "Failed to send newsletter");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSending(false);
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    try {
      const data = await previewNewsletter();
      if (data.success) {
        setPreviewHtml(data.html ?? null);
        toast.success(`Preview: ${data.count} bookmarks`);
      } else {
        toast.error(data.error || "Failed to preview");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          onClick={handleSend}
          disabled={sending || !hasBookmarks}
          size="sm"
        >
          {sending ? "Sending..." : "Send Now"}
        </Button>
        <Button
          variant="outline"
          onClick={handlePreview}
          disabled={previewing || !hasBookmarks}
          size="sm"
        >
          {previewing ? "Loading..." : "Preview"}
        </Button>
      </div>

      {previewUrl && (
        <div className="border rounded-md overflow-auto max-h-[500px]">
          <iframe
            src={previewUrl}
            title="Newsletter preview"
            className="w-full min-h-[400px] border-0"
            sandbox=""
          />
        </div>
      )}
    </div>
  );
}
