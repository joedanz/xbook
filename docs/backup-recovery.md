# Backup & Recovery

How to back up and restore your xbook data.

## What to Back Up

| File | Purpose | Location |
|------|---------|----------|
| `xbook.db` | All bookmarks, folders, tags, sync history | `DB_PATH` (default: `./xbook.db`) |
| `.tokens.json` | X OAuth tokens | `TOKEN_FILE_PATH` (default: `./.tokens.json`) |
| `.env` / `.env.local` | Configuration | Project root or `web/` |
| `ENCRYPTION_KEY` | Token encryption key (if set) | Environment variable |

### Backing up SQLite

**Option 1: File copy (while xbook is stopped)**

```bash
cp xbook.db xbook.db.backup
```

**Option 2: SQLite `.backup` command (safe while running)**

```bash
sqlite3 xbook.db ".backup xbook.db.backup"
```

**Option 3: Docker volume backup**

```bash
# Find the volume
docker volume inspect xbook_data

# Copy from container
docker cp xbook:/data/xbook.db ./xbook.db.backup
```

### Automated backups (cron)

```bash
# Add to crontab: daily backup at 2am, keep 7 days
0 2 * * * sqlite3 /path/to/xbook.db ".backup /backups/xbook-$(date +\%Y\%m\%d).db" && find /backups -name "xbook-*.db" -mtime +7 -delete
```

### Restoring from backup

```bash
# Stop xbook first
docker compose down  # or stop the process

# Replace the database
cp xbook.db.backup xbook.db

# Restart
docker compose up -d
```

### Encryption key

If you set `ENCRYPTION_KEY`, your OAuth tokens are encrypted at rest in the database. **Store this key separately** — without it, encrypted tokens cannot be decrypted and you'll need to re-authenticate with `xbook login`.

```bash
# Save your encryption key
echo "$ENCRYPTION_KEY" > /secure/location/xbook-encryption-key.txt
chmod 600 /secure/location/xbook-encryption-key.txt
```

## Disaster Recovery Checklist

1. Database file (`xbook.db`) restorable?
2. `ENCRYPTION_KEY` available (if encryption was enabled)?
3. X API credentials (`X_CLIENT_ID`, `X_CLIENT_SECRET`) available?
4. If tokens are lost: re-run `xbook login` (CLI) or reconnect X on the dashboard
