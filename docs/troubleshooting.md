# Troubleshooting

Common issues and their solutions when running xbook.

## OAuth "localhost" Rejection

**Symptom:** Clicking "Connect X Account" fails with an error from X, or the callback URL doesn't match.

**Cause:** The X API rejects `localhost` in OAuth redirect URIs. You must use `127.0.0.1` instead.

**Fix:** Set `OAUTH_REDIRECT_URI` in your environment:

```bash
# In .env.local (local dev) or .env (Docker)
OAUTH_REDIRECT_URI=http://127.0.0.1:3000/api/connect-x/callback
```

Also update your X Developer Portal app settings to list `http://127.0.0.1:3000/api/connect-x/callback` as an allowed redirect URI.

If `OAUTH_REDIRECT_URI` is not set, xbook derives it from the incoming request's origin (e.g., `${url.origin}/api/connect-x/callback`). If the browser sends `localhost`, X will reject it.

---

## X API Rate Limits

**Symptom:** Sync logs show `Rate limited. Waiting Xs before retry...` or fail with `Rate limited after maximum retries`.

**Cause:** The X API enforces per-endpoint rate limits. The bookmarks endpoint allows approximately 15 requests per 15-minute window on the Basic tier.

**How retry logic works:**

1. When xbook receives a `429` response, it reads the `x-rate-limit-reset` header to determine exactly when the limit resets.
2. It waits until that timestamp, then retries.
3. If no reset header is present, it falls back to waiting 60 seconds.
4. It retries up to 3 times before giving up.

**What to do:**

- **Wait it out.** Rate limits reset automatically (usually within 15 minutes). Run sync again after the window resets.
- **Reduce sync frequency.** If using `xbook serve --cron`, space syncs at least 15 minutes apart.
- **Check your X API tier.** The Free tier has stricter limits than Basic or Pro.

---

## Token Refresh Failures

**Symptom:** Sync fails with `Token refresh failed` or `Token refresh rate limited after maximum retries`.

**Cause:** OAuth2 refresh tokens can fail for several reasons:

- The refresh token has been revoked (e.g., you disconnected the app from X settings).
- The refresh token has expired (X refresh tokens expire after a period of inactivity).
- The X API is temporarily unavailable or rate limiting token refresh requests.
- `X_CLIENT_ID` or `X_CLIENT_SECRET` changed since the token was issued.

**How retry logic works:**

The token refresh function retries up to 3 times with exponential backoff (1s, 2s, 4s). On `429` responses, it respects the `x-rate-limit-reset` header.

**Fix:** Re-authenticate by clicking "Connect X Account" in the web dashboard, or run `npx xbook login` from the CLI. This issues a fresh token pair.

---

## Newsletter Not Sending

**Symptom:** `xbook newsletter` fails, or the scheduled newsletter never arrives.

**Check these in order:**

1. **`RESEND_API_KEY` not set.** The newsletter requires a [Resend](https://resend.com) API key. Without it, email sending is disabled entirely. Set it in `.env.local`:

   ```bash
   RESEND_API_KEY=re_xxxxx
   ```

2. **`NEWSLETTER_TO` not set.** xbook needs a recipient email address:

   ```bash
   NEWSLETTER_TO=you@example.com
   ```

3. **`NEWSLETTER_FROM` domain not verified.** Resend requires you to verify the sender domain. The default is `newsletters@yourdomain.com` -- update it to a domain you've verified in Resend:

   ```bash
   NEWSLETTER_FROM=bookmarks@yourdomain.com
   ```

4. **Resend API errors.** If the API key is valid but sending fails, check:
   - The Resend dashboard for delivery logs and bounces.
   - That your account is not on a free tier that has been exhausted.
   - The error message in the xbook logs: `Failed to send email: <message>`.

5. **No new bookmarks.** The newsletter only sends when there are new bookmarks since the last issue. Use `xbook newsletter --dry-run` to preview what would be sent.

---

## `ENCRYPTION_KEY` Not Set

**Symptom:** Tokens are stored as plaintext in the database.

**What happens:** The `ENCRYPTION_KEY` is optional. If not set, `encryptIfAvailable()` and `decryptIfAvailable()` pass data through unchanged and tokens are stored as plaintext in the `.tokens.json` file or SQLite database. This is fine for local/self-hosted deployments where the database is not exposed.

**To enable encryption (optional):**

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This produces a 64-character hex string (32 bytes). Set it in your environment:

```bash
ENCRYPTION_KEY=<your-64-char-hex-string>
```

**Key requirements:** Exactly 64 hex characters (32 bytes). The app will throw an error on startup if the key is present but the wrong length.

**Rotating keys:**

There is no built-in key rotation command. To rotate:

1. Set the new `ENCRYPTION_KEY`.
2. Existing tokens encrypted with the old key will fail to decrypt. The decryption function returns the ciphertext as-is when decryption fails (graceful fallback).
3. Re-authenticate ("Connect X Account" or `xbook login`) to store tokens encrypted with the new key.

---

## SQLite BUSY / LOCKED Errors

**Symptom:** `SQLITE_BUSY` or `database is locked` errors during sync or API requests.

**Cause:** Multiple processes or connections are trying to write to the SQLite database simultaneously. This can happen if:

- The web server and a CLI sync are running at the same time.
- Multiple Docker containers share the same database file.

**How xbook mitigates this:**

- **WAL mode** is enabled (`journal_mode = WAL`), which allows concurrent reads while a write is in progress.
- **Busy timeout** is set to 5000ms (`busy_timeout = 5000`), meaning SQLite will wait up to 5 seconds for a lock before returning an error.

**Fix:**

- Ensure only one process writes to the database at a time. In Docker, use a single container.
- If using `xbook serve`, it handles sync and newsletter sequentially to avoid conflicts.
- Do not mount the same SQLite file into multiple containers.

---

## `better-sqlite3` Build Failures

**Symptom:** `npm install` fails with errors about `better-sqlite3`, `node-gyp`, or native compilation.

**Cause:** `better-sqlite3` is a native Node.js module that requires a C/C++ toolchain to compile.

**Required build tools:**

| Platform | Install command |
|----------|----------------|
| macOS | `xcode-select --install` |
| Ubuntu/Debian | `sudo apt-get install python3 make g++` |
| Alpine (Docker) | `apk add python3 make g++` |
| Windows | Install "Desktop development with C++" via Visual Studio Build Tools |

**After installing build tools:**

```bash
npm rebuild better-sqlite3
```

**Docker note:** The Dockerfile already installs `python3 make g++` in the build stage and runs `npm rebuild better-sqlite3` for the production image. If you're seeing build failures in Docker, ensure you're using the provided `Dockerfile` and not a custom one that skips these steps.

**Node.js version:** `better-sqlite3` requires Node.js 20+. Check with `node --version`.

---

## Docker Container Shows Unhealthy

**Symptom:** `docker ps` shows the xbook container as `unhealthy`.

**How the health check works:**

The Dockerfile defines a health check that runs every 30 seconds:

```
wget -q --spider http://localhost:3000/api/v1/status || exit 1
```

It starts checking 10 seconds after container start and allows 3 failures before marking unhealthy.

**Debugging steps:**

1. **Check container logs:**

   ```bash
   docker compose logs xbook
   ```

2. **Test the status endpoint manually:**

   ```bash
   curl http://localhost:3000/api/v1/status
   ```

   A healthy response looks like:

   ```json
   {
     "status": "ok",
     "mode": "local",
     "version": "0.1.0",
     "database": "ok",
     "timestamp": "2026-03-04T12:00:00.000Z"
   }
   ```

3. **Check for database errors.** If the response includes `"database": "error"`, the `databaseMessage` field will explain why. Common causes:
   - The `/data` volume is not mounted or not writable.
   - The SQLite database file is corrupted.
   - Missing `DB_PATH` environment variable (should default to `/data/xbook.db` in Docker).

4. **Check environment variables.** Ensure `.env` is present and `env_file: .env` is set in `docker-compose.yml`. Missing `X_CLIENT_ID` won't prevent startup but will prevent sync.

5. **Port conflicts.** Ensure nothing else is using port 3000, or remap it in `docker-compose.yml`:

   ```yaml
   ports:
     - "8080:3000"
   ```
