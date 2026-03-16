# Import File Formats

xbook can import bookmarks from JSON and CSV files via the CLI (`xbook import`) or the web UI's Import page.

**File size limit:** 10 MB

**Duplicate handling:** Bookmarks with the same tweet ID as existing bookmarks are automatically skipped.

**Encoding:** UTF-8 (BOM is automatically stripped if present).

---

## JSON — Flat Format

A plain JSON array of bookmark objects. This is the simplest format.

### Required Fields

| Field | Aliases | Description |
|-------|---------|-------------|
| `id` | `tweet_id`, `tweetId` | Tweet ID |
| `text` | `full_text`, `tweet_text` | Tweet text content |

### Optional Fields

| Field | Aliases | Description |
|-------|---------|-------------|
| `created_at` | `createdAt` | Tweet creation timestamp |
| `author_id` | `user_id` | Author's user ID |
| `author_username` | `screen_name`, `username` | Author's handle |
| `author_name` | `name` | Author's display name |
| `media_url` | `mediaUrl` | Media thumbnail URL |
| `expanded_url` | `url` | Expanded link URL |

If `media_url` is not a string field, the parser also checks for a `media` array and reads the first item's `thumbnail`, `original`, or `media_url_https` field.

### Example

```json
[
  {
    "id": "1234567890",
    "text": "This is a great thread about TypeScript patterns",
    "created_at": "2026-01-15T12:00:00.000Z",
    "author_id": "9876",
    "author_username": "johndoe",
    "author_name": "John Doe",
    "expanded_url": "https://example.com/article"
  },
  {
    "tweet_id": "1234567891",
    "full_text": "Another bookmark",
    "user_id": "9876",
    "screen_name": "johndoe"
  }
]
```

---

## JSON — twitter-web-exporter Format

Exported by the [twitter-web-exporter](https://github.com/prinsss/twitter-web-exporter) browser extension. This format is auto-detected when items contain `rest_id`, `legacy`, or `core` fields.

### Structure

Each item has:
- `rest_id` — Tweet ID
- `legacy.full_text` — Tweet text
- `legacy.created_at` — Creation timestamp
- `legacy.entities.media[].media_url_https` — Media URL
- `legacy.entities.urls[].expanded_url` — Expanded URL
- `core.user_results.result.rest_id` — Author user ID
- `core.user_results.result.legacy.screen_name` — Author handle
- `core.user_results.result.legacy.name` — Author display name

### Example

```json
[
  {
    "rest_id": "1234567890",
    "legacy": {
      "full_text": "This is a great thread about TypeScript patterns",
      "created_at": "Wed Jan 15 12:00:00 +0000 2026",
      "entities": {
        "urls": [
          { "expanded_url": "https://example.com/article" }
        ],
        "media": [
          { "media_url_https": "https://pbs.twimg.com/media/example.jpg" }
        ]
      }
    },
    "core": {
      "user_results": {
        "result": {
          "rest_id": "9876",
          "legacy": {
            "screen_name": "johndoe",
            "name": "John Doe"
          }
        }
      }
    }
  }
]
```

### How to Export from X

1. Install the [twitter-web-exporter](https://github.com/prinsss/twitter-web-exporter) browser extension
2. Go to your X bookmarks page (https://x.com/i/bookmarks)
3. Scroll through all your bookmarks to load them
4. Use the extension's export button to save as JSON
5. Import the file: `xbook import bookmarks.json`

---

## CSV Format

A CSV file with a header row. Uses the same field aliases as the flat JSON format.

### Required Columns

| Column | Aliases |
|--------|---------|
| `id` | `tweet_id`, `tweetId` |
| `text` | `full_text`, `tweet_text` |

### Optional Columns

| Column | Aliases |
|--------|---------|
| `created_at` | `createdAt` |
| `author_id` | `user_id` |
| `author_username` | `screen_name`, `username` |
| `author_name` | `name` |
| `media_url` | `mediaUrl` |
| `expanded_url` | `url` |

### Example

```csv
id,text,author_username,author_name,created_at
1234567890,"This is a great thread about TypeScript patterns",johndoe,John Doe,2026-01-15T12:00:00.000Z
1234567891,"Another bookmark with ""quoted"" text",janedoe,Jane Doe,2026-01-16T08:30:00.000Z
```

**Notes:**
- Fields containing commas or newlines must be enclosed in double quotes
- Double quotes within quoted fields are escaped by doubling them (`""`)
- Empty rows are skipped
