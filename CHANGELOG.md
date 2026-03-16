# Changelog

All notable changes to xbook are documented in this file.

## v0.1.0 — Initial Release

### Features

- **Bookmark sync** from X (Twitter) via OAuth 2.0 PKCE, including folder assignments
- **Bookmark import** from JSON and CSV files (for full history beyond the API's ~100 limit)
- **Web interface** (Next.js) with dashboard, search, folder/author filters, sort, grid layout, notes, tags, and starring
- **Newsletter** — weekly HTML email digest of new bookmarks via Resend, with List-Unsubscribe support
- **CLI** — `xbook sync`, `xbook import`, `xbook newsletter`, `xbook serve` (cron), `xbook login`, and more
- **Scheduled operation** — `xbook serve --cron` for hands-off sync and newsletter delivery
- **Docker** deployment with SQLite persistence, health check, and `docker compose` support
- **Cloud mode** — multi-tenant Postgres (Neon) deployment with Better Auth social sign-in, API keys, rate limiting, and sync locking
- **Settings page** — X account connection status, newsletter email configuration (cloud), and API key management (cloud)

### Architecture

- Dual-mode: **local** (SQLite, single-user) and **cloud** (Postgres, multi-user via Better Auth)
- AES-256-GCM encryption for OAuth tokens at rest (cloud mode)
- Rate limit handling with exponential backoff for X API and token refresh
- WAL mode and busy timeout for SQLite concurrency
- Article metadata enrichment via Twitter syndication API
- Repository pattern with shared interface for SQLite and Drizzle/Postgres backends
- Dual-backend rate limiting (in-memory + Postgres atomic upsert)
- Dual-backend sync locking with TTL (in-memory + Postgres row-level)

### Security

- Timing-safe CRON_SECRET comparison to prevent timing attacks
- Sanitized error responses — database internals are never leaked to clients
- PKCE OAuth flow with state validation and encrypted token storage
- Security headers (CSP, X-Frame-Options, HSTS, X-Content-Type-Options)
- Non-root Docker user with read-only filesystem recommendations
- API key authentication with SHA-256 hashing for cloud mode

### API

- REST API at `/api/v1/` — bookmarks (list, get, update, delete), folders, stats, sync, newsletter, import
- Rate limits: 100 req/min general, 5 req/min sync
- Health check endpoint with database connectivity status
- Full API reference documentation

### Testing

- 239+ tests across 16 test files + 7 web test files
- Real SQLite integration tests with in-memory databases
- Import parser coverage (23 tests) for JSON, CSV, and edge cases
- Encryption round-trip tests (24 tests) for AES-256-GCM
- OAuth callback tests with PKCE and state validation
- Bookmarks API tests (GET, PATCH, DELETE)

### Documentation

- README with Docker quickstart, CLI usage, and self-hosting guide
- API reference with all endpoints, parameters, and response formats
- Cloud deployment guide for Vercel + Neon
- Environment variable reference for both modes
