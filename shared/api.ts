// ABOUTME: X (Twitter) API client for fetching bookmarks, folders, and user info.
// ABOUTME: Handles pagination and rate limiting. Shared by CLI and web.

import type {
  Tweet,
  User,
  BookmarkFolder,
  BookmarkResponse,
  FolderResponse,
} from "./types";

export interface ApiCallOptions {
  onRateLimit?: (waitSeconds: number, attempt: number, maxRetries: number) => void;
}

const BASE_URL = "https://api.x.com/2";
const SYNDICATION_URL = "https://cdn.syndication.twimg.com";

async function apiGet(
  path: string,
  accessToken: string,
  params?: Record<string, string>,
  maxRetries: number = 3,
  options?: ApiCallOptions
): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 429) {
      if (attempt === maxRetries) {
        throw new Error("Rate limited after maximum retries");
      }
      const reset = res.headers.get("x-rate-limit-reset");
      const waitSec = reset
        ? Math.max(1, parseInt(reset) - Math.floor(Date.now() / 1000))
        : 60;
      console.log(`Rate limited. Waiting ${waitSec}s before retry (attempt ${attempt + 1}/${maxRetries})...`);
      options?.onRateLimit?.(waitSec, attempt + 1, maxRetries);
      await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  throw new Error("apiGet: exhausted all retries without a response");
}

export async function getMe(accessToken: string, options?: ApiCallOptions): Promise<User> {
  const data = (await apiGet("/users/me", accessToken, undefined, 3, options)) as { data: User };
  return data.data;
}

export async function getBookmarks(
  accessToken: string,
  userId: string,
  paginationToken?: string,
  options?: ApiCallOptions
): Promise<BookmarkResponse> {
  const params: Record<string, string> = {
    "tweet.fields": "created_at,author_id,attachments,entities",
    expansions: "author_id,attachments.media_keys",
    "user.fields": "name,username",
    "media.fields": "url,preview_image_url,type",
    max_results: "100",
  };
  if (paginationToken) {
    params.pagination_token = paginationToken;
  }

  interface MediaObject {
    media_key: string;
    type: string;
    url?: string;
    preview_image_url?: string;
  }

  interface UrlEntity {
    url: string;
    expanded_url?: string;
    unwound_url?: string;
    title?: string;
    description?: string;
    images?: { url: string; width: number; height: number }[];
  }

  interface RawTweet extends Tweet {
    attachments?: { media_keys?: string[] };
    entities?: { urls?: UrlEntity[] };
    article?: { title?: string };
  }

  const data = (await apiGet(`/users/${userId}/bookmarks`, accessToken, params, 3, options)) as {
    data?: RawTweet[];
    includes?: { users?: User[]; media?: MediaObject[] };
    meta?: { next_token?: string; result_count?: number };
  };

  const users = new Map<string, User>();
  if (data.includes?.users) {
    for (const user of data.includes.users) {
      users.set(user.id, user);
    }
  }

  // Build media lookup: media_key -> image URL
  const mediaMap = new Map<string, string>();
  if (data.includes?.media) {
    for (const m of data.includes.media) {
      if (m.type === "photo" && m.url) {
        mediaMap.set(m.media_key, m.url);
      } else if (m.preview_image_url) {
        mediaMap.set(m.media_key, m.preview_image_url);
      }
    }
  }

  // Attach first image URL and URL entity metadata to each tweet
  const tweets: Tweet[] = (data.data || []).map((t) => {
    const mediaKeys = t.attachments?.media_keys;
    let media_url: string | undefined;
    if (mediaKeys) {
      for (const key of mediaKeys) {
        const url = mediaMap.get(key);
        if (url) {
          media_url = url;
          break;
        }
      }
    }

    // Extract URL entity metadata from first URL entity.
    // Prefer one with a title (rich card), fall back to any entity for expanded_url.
    // For X Articles, use article.title as fallback when entities have no metadata.
    let url_title: string | undefined;
    let url_description: string | undefined;
    let url_image: string | undefined;
    let expanded_url: string | undefined;
    const richEntity = t.entities?.urls?.find((u) => u.title);
    if (richEntity) {
      url_title = richEntity.title;
      url_description = richEntity.description;
      url_image = richEntity.images?.[0]?.url;
      expanded_url = richEntity.unwound_url || richEntity.expanded_url;
    } else if (t.entities?.urls?.length) {
      const firstUrl = t.entities.urls[0];
      expanded_url = firstUrl.unwound_url || firstUrl.expanded_url;
    }
    // X Articles have a separate article.title field
    if (!url_title && t.article?.title) {
      url_title = t.article.title;
    }

    return {
      id: t.id,
      text: t.text,
      created_at: t.created_at,
      author_id: t.author_id,
      media_url,
      url_title,
      url_description,
      url_image,
      expanded_url,
    };
  });

  return {
    tweets,
    users,
    nextToken: data.meta?.next_token,
  };
}

export async function getBookmarkFolders(
  accessToken: string,
  userId: string,
  paginationToken?: string,
  options?: ApiCallOptions
): Promise<FolderResponse> {
  const params: Record<string, string> = {};
  if (paginationToken) {
    params.pagination_token = paginationToken;
  }

  const data = (await apiGet(`/users/${userId}/bookmarks/folders`, accessToken, params, 3, options)) as {
    data?: BookmarkFolder[];
    meta?: { next_token?: string };
  };

  return {
    folders: data.data || [],
    nextToken: data.meta?.next_token,
  };
}

export interface FolderBookmarkIdsResponse {
  tweetIds: string[];
  nextToken?: string;
}

export async function getFolderBookmarks(
  accessToken: string,
  userId: string,
  folderId: string,
  paginationToken?: string,
  options?: ApiCallOptions
): Promise<FolderBookmarkIdsResponse> {
  // The folder bookmarks endpoint only accepts id/folder_id params —
  // it does NOT support tweet.fields, expansions, user.fields, or max_results.
  const params: Record<string, string> = {};
  if (paginationToken) {
    params.pagination_token = paginationToken;
  }

  const data = (await apiGet(
    `/users/${userId}/bookmarks/folders/${folderId}`,
    accessToken,
    params,
    3,
    options
  )) as {
    data?: { id: string }[];
    meta?: { next_token?: string };
  };

  return {
    tweetIds: (data.data || []).map((t) => t.id),
    nextToken: data.meta?.next_token,
  };
}

export interface ArticleMetadata {
  imageUrl: string | null;
  previewText: string | null;
}

/**
 * Fetch article metadata from the public Twitter syndication API.
 * This endpoint powers embedded tweets and returns richer article data
 * than the v2 API, including cover_media image URLs and preview_text.
 */
export async function fetchArticleMetadata(
  tweetId: string
): Promise<ArticleMetadata> {
  try {
    const res = await fetch(
      `${SYNDICATION_URL}/tweet-result?id=${tweetId}&token=x`
    );
    if (!res.ok) return { imageUrl: null, previewText: null };

    const data = (await res.json()) as {
      article?: {
        preview_text?: string;
        cover_media?: {
          media_info?: {
            original_img_url?: string;
          };
        };
      };
    };

    return {
      imageUrl: data.article?.cover_media?.media_info?.original_img_url || null,
      previewText: data.article?.preview_text || null,
    };
  } catch {
    return { imageUrl: null, previewText: null };
  }
}
