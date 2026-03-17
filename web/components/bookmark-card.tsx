"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Star, BookOpen, ExternalLink } from "lucide-react";
import type { StoredBookmark } from "@shared/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkActionsMenu } from "@/components/bookmark-actions-menu";
import { NoteEditor } from "@/components/note-editor";
import { TagInput } from "@/components/tag-input";
import { FormattedDate } from "@/components/formatted-date";
import { toggleStarred, toggleNeedToRead } from "@/lib/actions";
import { tweetUrl } from "@shared/urls";

export function BookmarkCard({
  bookmark,
}: {
  bookmark: StoredBookmark;
}) {
  const tags: string[] = useMemo(
    () => (bookmark.tags ? JSON.parse(bookmark.tags) : []),
    [bookmark.tags]
  );
  const [editingNotes, setEditingNotes] = useState(false);
  const [isStarred, setIsStarred] = useState(bookmark.starred);
  const [isNeedToRead, setIsNeedToRead] = useState(bookmark.need_to_read);
  const [isPending, startTransition] = useTransition();

  async function handleToggleStar() {
    const prev = isStarred;
    setIsStarred(!prev);
    startTransition(async () => {
      const result = await toggleStarred(bookmark.tweet_id);
      if (!result.success) setIsStarred(prev);
    });
  }

  async function handleToggleNeedToRead() {
    const prev = isNeedToRead;
    setIsNeedToRead(!prev);
    startTransition(async () => {
      const result = await toggleNeedToRead(bookmark.tweet_id);
      if (!result.success) setIsNeedToRead(prev);
    });
  }

  // Use media_url first, fall back to url_image for article previews
  const heroImage = bookmark.media_url || bookmark.url_image;
  const articleUrl = bookmark.expanded_url;
  let displayDomain: string | undefined;
  const isXArticle = articleUrl?.includes("/i/article/");
  if (articleUrl) {
    try { displayDomain = new URL(articleUrl).hostname.replace(/^www\./, ""); } catch {}
  }
  // Detect if tweet text is just a bare t.co link
  const isBareLink = /^https:\/\/t\.co\/\w+$/.test(bookmark.text.trim());

  return (
    <Card className="overflow-hidden flex flex-col">
      {/* Hero image */}
      {heroImage && (
        <a
          href={articleUrl || tweetUrl(bookmark.tweet_id, bookmark.author_username)}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative aspect-video"
          aria-label={bookmark.url_title || `Bookmark by ${bookmark.author_name || bookmark.author_username || "unknown"}`}
        >
          <Image
            src={heroImage}
            alt={`${bookmark.author_name || bookmark.author_username || "Unknown"}: ${bookmark.text?.substring(0, 100) || bookmark.url_title || "bookmark"}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
        </a>
      )}

      <CardContent className="pt-3 flex-1 flex flex-col">
        {/* Author row with actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">
              {bookmark.author_name || "Unknown"}
            </span>
            {bookmark.author_username && (
              <span className="text-muted-foreground text-xs truncate">
                @{bookmark.author_username}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={isPending}
              onClick={handleToggleNeedToRead}
              title={isNeedToRead ? "Remove from reading list" : "Add to reading list"}
              aria-label={isNeedToRead ? "Remove from reading list" : "Add to reading list"}
            >
              <BookOpen
                className={`h-4 w-4 ${isNeedToRead ? "fill-blue-400 text-blue-400" : "text-muted-foreground"}`}
                aria-hidden="true"
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={isPending}
              onClick={handleToggleStar}
              aria-label={isStarred ? "Unstar bookmark" : "Star bookmark"}
            >
              <Star
                className={`h-4 w-4 ${isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                aria-hidden="true"
              />
            </Button>
            <BookmarkActionsMenu
              tweetId={bookmark.tweet_id}
              onEditNotes={
                !editingNotes && !bookmark.notes
                  ? () => setEditingNotes(true)
                  : undefined
              }
            />
          </div>
        </div>

        {/* Tweet text or link display — full width */}
        <div className="mt-1.5 space-y-1.5">
          {isBareLink ? (
            <>
              {bookmark.url_title && (
                <a
                  href={articleUrl || tweetUrl(bookmark.tweet_id, bookmark.author_username)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium line-clamp-2 hover:underline"
                >
                  {bookmark.url_title}
                </a>
              )}
              {bookmark.url_description && (
                <p className="text-sm text-muted-foreground line-clamp-4">
                  {bookmark.url_description}
                </p>
              )}
              {articleUrl && (
                <a
                  href={articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline mt-0.5"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  <span>{isXArticle ? "X Article" : displayDomain}</span>
                </a>
              )}
            </>
          ) : (
            <>
              <p className="text-sm line-clamp-4">{bookmark.text}</p>

              {/* Article link card (for tweets with both text and a URL) */}
              {bookmark.url_title && articleUrl && (
                <a
                  href={articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md border p-2.5 hover:bg-accent transition-colors mt-1"
                >
                  <p className="text-sm font-medium line-clamp-2">{bookmark.url_title}</p>
                  {bookmark.url_description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {bookmark.url_description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span>{displayDomain}</span>
                  </div>
                </a>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-2 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {bookmark.need_to_read && (
              <Badge variant="secondary" className="text-xs">
                Need to read
              </Badge>
            )}
            {bookmark.folder_name && (
              <Badge variant="outline" className="text-xs">
                {bookmark.folder_name}
              </Badge>
            )}
            {bookmark.created_at && (
              <FormattedDate date={bookmark.created_at} className="text-muted-foreground text-xs" />
            )}
            <a
              href={tweetUrl(bookmark.tweet_id, bookmark.author_username)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline ml-auto"
              aria-label={`View bookmark by ${bookmark.author_name || bookmark.author_username || "unknown"} on X`}
            >
              View on X<span className="sr-only"> (opens in new tab)</span>
            </a>
          </div>

          {/* Tags */}
          <TagInput tweetId={bookmark.tweet_id} initialTags={tags} />

          {/* Notes */}
          {(editingNotes || bookmark.notes) && (
            <NoteEditor
              tweetId={bookmark.tweet_id}
              initialNotes={bookmark.notes}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
