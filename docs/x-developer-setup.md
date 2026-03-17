# X Developer Account Setup

xbook needs X (Twitter) API credentials to sync your bookmarks. This guide walks you through getting them.

## 1. Create a Developer Account

1. Go to the [X Developer Portal](https://developer.x.com)
2. Sign in with your X account
3. Apply for a developer account if you don't have one
   - Select "Hobbyist" or "Student" use case
   - Describe your use: "Personal bookmark organizer for managing and searching my saved posts"
4. Accept the Developer Agreement

## 2. Create a Project & App

1. In the Developer Portal, go to **Projects & Apps**
2. Click **+ Add Project**
   - Name: `xbook` (or anything you like)
   - Use case: Personal
   - Description: "Bookmark organizer"
3. Click **+ Add App** within the project
   - Name: `xbook-app`
   - Environment: Production

## 3. Configure OAuth 2.0

1. Go to your app's **Settings** tab
2. Under **User authentication settings**, click **Set up**
3. Configure:
   - **App permissions:** Read (minimum — xbook only reads bookmarks)
   - **Type of App:** Web App, Automated App or Bot
   - **Callback URI / Redirect URL:**
     - CLI: `http://127.0.0.1:8917/callback`
     - Web: `http://localhost:3000/api/connect-x/callback`
   - **Website URL:** Your domain or `https://github.com/joedanz/xbook`
4. Click **Save**

## 4. Get Your Credentials

1. Go to your app's **Keys and Tokens** tab
2. Under **OAuth 2.0 Client ID and Client Secret:**
   - Copy the **Client ID**
   - Click **Regenerate** to get the **Client Secret** (shown once)
3. Save these securely

## 5. Configure xbook

### CLI

Add to your `.env.local` file in the project root:

```bash
X_CLIENT_ID=your_client_id_here
X_CLIENT_SECRET=your_client_secret_here
```

Then run:

```bash
xbook login
```

### Web

Add to `.env.local` in the project root:

```bash
X_CLIENT_ID=your_client_id_here
X_CLIENT_SECRET=your_client_secret_here
```

### Docker

Pass as environment variables:

```bash
docker run -e X_CLIENT_ID=... -e X_CLIENT_SECRET=... ghcr.io/joedanz/xbook
```

Or in `docker-compose.yml`:

```yaml
environment:
  - X_CLIENT_ID=your_client_id_here
  - X_CLIENT_SECRET=your_client_secret_here
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Invalid redirect_uri" during login | Make sure the callback URL in the X Developer Portal matches exactly (including port and path) |
| "Forbidden" when syncing bookmarks | Ensure your app has at least **Read** permissions in User Authentication Settings |
| "Rate limit exceeded" from X API | X API has its own rate limits (300 requests / 15 minutes for bookmarks). Wait and try again. |
| OAuth callback uses `localhost` | X rejects `localhost` — use `127.0.0.1` instead, or set `OAUTH_REDIRECT_URI` explicitly |

## X API Rate Limits

xbook respects X's API rate limits. The bookmark lookup endpoint allows:
- **300 requests per 15-minute window** per user token
- Each request fetches up to 100 bookmarks

For most users, a single sync fetches all bookmarks within these limits.
