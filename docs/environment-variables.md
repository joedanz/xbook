# Environment Variables

Complete reference for all xbook environment variables.

## X API Credentials

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `X_CLIENT_ID` | Yes | -- | OAuth 2.0 Client ID from the [X Developer Portal](https://developer.x.com) |
| `X_CLIENT_SECRET` | Yes | -- | OAuth 2.0 Client Secret from the X Developer Portal |

## Newsletter

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | No | -- | API key from [Resend](https://resend.com). Required to send newsletter emails. Without it, newsletter functionality is disabled. |
| `NEWSLETTER_TO` | No | -- | Recipient email address for the newsletter. |
| `NEWSLETTER_FROM` | No | `newsletters@yourdomain.com` | Sender email address for newsletters. Must be from a domain verified in Resend. |

## OAuth

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OAUTH_REDIRECT_URI` | No | Auto-detected from request origin | Full redirect URI for the X OAuth callback (e.g., `http://127.0.0.1:3000/api/connect-x/callback`). Set this if the auto-detected origin uses `localhost` (which X rejects). |
| `OAUTH_CALLBACK_PORT` | No | `8917` | Port for the CLI OAuth callback server. |

## Database & Storage

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_PATH` | No | `./xbook.db` (local), `/data/xbook.db` (Docker) | Path to the SQLite database file. |
| `TOKEN_FILE_PATH` | No | `./.tokens.json` (local), `/data/.tokens.json` (Docker) | Path to the OAuth token file. |

## CLI Client

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `XBOOK_API_KEY` | No | -- | API key for authenticating CLI requests. Alternative to `xbook login`. |
| `XBOOK_API_URL` | No | `http://localhost:3000` | Base URL of the xbook API server. |
| `XBOOK_OUTPUT` | No | -- | Set to `json` for machine-readable CLI output. Same as `--json` flag. |

## Docker / Runtime

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `production` (Docker) | Node.js environment. Set to `production` in Docker. |
| `PORT` | No | `3000` | HTTP port the web server listens on. |
| `HOSTNAME` | No | `0.0.0.0` (Docker) | Network interface to bind to. |
| `NEXT_TELEMETRY_DISABLED` | No | `1` (Docker) | Disables Next.js telemetry when set to `1`. |

## Configuration Files

| File | Used by | Description |
|------|---------|-------------|
| `.env` | Docker (`docker compose`) | Environment variables for Docker deployments. Copy from `.env.example`. |
| `.env.local` | Local dev (Next.js, CLI) | Environment variables for local development. Copy from `.env.local.example`. Next.js reads this automatically from the project root via `next.config.ts`. Not committed to git. |
| `~/.xbook/config.json` | CLI client | Stores CLI settings (API key, API URL). Managed by `xbook login` / `xbook logout`. |
| `.tokens.json` | Local mode | OAuth tokens file. Created by web OAuth flow. Permissions set to `0600`. |
