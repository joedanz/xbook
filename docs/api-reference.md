# API Reference

xbook exposes a REST API at `/api/v1/` for programmatic access. The CLI uses this same API.

## Authentication

No authentication required. All requests are treated as the local user.

### Rate Limits

All API endpoints are rate-limited per client IP.

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API (`/api/v1/*`) | 100 requests | 60 seconds |
| Sync (`POST /api/v1/sync`) | 5 requests | 60 seconds |

When a rate limit is exceeded, the API returns `429 Too Many Requests`. Rate limit state is tracked in-memory.

### Error Responses

All endpoints return errors in this format:

```json
{ "error": "Error message here" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (invalid parameters or body) |
| 401 | Not authenticated (X account not connected) |
| 404 | Resource not found |
| 429 | Rate limit exceeded (check `Retry-After` header) |
| 500 | Server error |

---

## Endpoints

### GET /api/v1/status

Health check. Returns server status and mode.

**Authentication:** None required.

**Response:**

```json
{
  "status": "ok",
  "mode": "local",
  "version": "0.1.0",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "database": "ok"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `"ok"` or `"degraded"` (returns 503 when degraded) |
| `mode` | string | `"local"` |
| `version` | string | Server version |
| `timestamp` | string | Current server time (ISO 8601) |
| `database` | string | `"ok"` or `"error"` |
| `databaseMessage` | string? | Error details (only present when database is `"error"`) |

---

### GET /api/v1/me

Returns the local user's profile.

**Response:**

```json
{
  "userId": "local",
  "name": "Local User",
  "mode": "local"
}
```

---

### GET /api/v1/bookmarks

List and search bookmarks with pagination and filtering.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | Free-text search |
| `folder` | string | — | Filter by folder ID |
| `author` | string | — | Filter by author username |
| `starred` | boolean | — | Filter starred bookmarks (`true`/`false`) |
| `need_to_read` | boolean | — | Filter need-to-read bookmarks |
| `tags` | string | — | Comma-separated tag list |
| `page` | integer | 1 | Page number |
| `page_size` | integer | 20 | Results per page (max 100) |
| `order_by` | string | — | Sort field |
| `order_dir` | string | — | Sort direction (`asc` or `desc`) |

**Response:**

```json
{
  "items": [
    {
      "tweet_id": "1234567890",
      "text": "Great thread on...",
      "author_username": "johndoe",
      "author_name": "John Doe",
      "starred": false,
      "folder_id": "folder_abc",
      "folder_name": "Tech",
      "created_at": "2026-01-01T00:00:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "totalPages": 3
}
```

---

### GET /api/v1/bookmarks/:id

Get a single bookmark by tweet ID.

**Response:** The bookmark object (same shape as items in the list response), or `404` if not found.

---

### PATCH /api/v1/bookmarks/:id

Update a bookmark's metadata (notes, tags, starred, folder).

**Request Body (all fields optional):**

```json
{
  "starred": true,
  "need_to_read": true,
  "notes": "Remember to revisit this",
  "add_tags": ["ai", "must-read"],
  "remove_tags": ["old-tag"],
  "folder_id": "folder_abc",
  "folder_name": "Tech"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `starred` | boolean | Set starred status |
| `need_to_read` | boolean | Set need-to-read status |
| `notes` | string or null | Set bookmark notes (max 10,000 chars) |
| `add_tags` | string[] | Tags to add |
| `remove_tags` | string[] | Tags to remove |
| `folder_id` | string or null | Move to folder (null to remove from folder) |
| `folder_name` | string or null | Folder display name (used with `folder_id`) |

**Response:**

```json
{ "success": true }
```

---

### DELETE /api/v1/bookmarks/:id

Delete a bookmark.

**Response:**

```json
{ "success": true }
```

---

### GET /api/v1/folders

List all bookmark folders with counts.

**Response:**

```json
{
  "folders": [
    { "id": "folder_abc", "name": "Tech", "count": 15 },
    { "id": "folder_def", "name": "Design", "count": 8 }
  ]
}
```

---

### GET /api/v1/stats

Dashboard statistics and sync history.

**Response:**

```json
{
  "stats": {
    "totalBookmarks": 142,
    "folderCount": 5,
    "lastSyncAt": "2026-01-01T09:00:00.000Z",
    "lastNewsletterAt": "2026-01-01T10:00:00.000Z",
    "bookmarksByFolder": [
      { "folder": "Tech", "count": 42 },
      { "folder": "Design", "count": 18 }
    ]
  },
  "syncHistory": [
    {
      "synced_at": "2026-01-01T09:00:00.000Z",
      "bookmarks_fetched": 50,
      "bookmarks_new": 3
    }
  ]
}
```

---

### POST /api/v1/sync

Trigger a bookmark sync from X. Requires X OAuth tokens to be configured.

**Request Body:** None.

**Response:**

```json
{
  "success": true,
  "fetched": 50,
  "newCount": 3,
  "foldersFound": 2
}
```

**Errors:**
- `401` — Not authenticated (X account not connected)
- `409` — Sync already in progress (another sync is running for this user)

---

### POST /api/v1/newsletter

Send or preview the weekly bookmark newsletter digest.

**Request Body:**

```json
{
  "dry_run": true
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `dry_run` | boolean | `false` | Preview without sending |

**Response (dry run):**

```json
{
  "success": true,
  "subject": "Your xbook digest — Jan 1",
  "count": 5,
  "html": "<html>..."
}
```

**Response (send):**

```json
{
  "success": true,
  "message": "Newsletter sent with 5 bookmarks",
  "count": 5
}
```

**Response (no new bookmarks):**

```json
{
  "success": true,
  "message": "No new bookmarks to send",
  "count": 0
}
```

**Errors:**
- `400` — No newsletter email configured
- `500` — `RESEND_API_KEY` not set

---

### POST /api/v1/import

Import bookmarks from a JSON or CSV file.

Accepts three input formats:

1. **Multipart file upload** (`Content-Type: multipart/form-data`) — file field named `file`
2. **Raw content** (`Content-Type: application/json`) — `{ "content": "...", "filename": "bookmarks.json" }`
3. **Pre-parsed data** (`Content-Type: application/json`) — `{ "tweets": [...], "users": {...} }`

**File size limit:** 10 MB.

**Response:**

```json
{
  "success": true,
  "total": 100,
  "imported": 85,
  "skipped": 15,
  "errors": 0,
  "format": "json-flat",
  "warnings": []
}
```

| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Total items processed |
| `imported` | integer | New bookmarks added |
| `skipped` | integer | Duplicates skipped |
| `errors` | integer | Items that failed |
| `format` | string | Detected format (`json-flat`, `json-twitter-exporter`, `csv`) |
| `warnings` | string[] | Parse warnings |

See [Import Formats](import-formats.md) for file format details.
