# Monitoring & Observability

How to monitor your xbook deployment.

## Health Check Endpoint

xbook exposes a health check at `GET /api/v1/status`:

```bash
curl http://localhost:3000/api/v1/status
```

Response:

```json
{
  "status": "ok",
  "mode": "local",
  "version": "0.1.0",
  "timestamp": "2026-03-15T12:00:00.000Z"
}
```

| Status | Meaning |
|--------|---------|
| `ok` | All systems healthy |
| `degraded` | Database connection failed |

This endpoint is rate-limited to 30 requests per minute per IP.

## Docker Healthcheck

The Docker image includes a built-in healthcheck:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/status || exit 1
```

Check container health:

```bash
docker inspect --format='{{.State.Health.Status}}' xbook
```

## Logging

xbook logs to stdout/stderr (standard for Docker).

### What's logged

| Event | Level | Example |
|-------|-------|---------|
| Sync completed | info | `Cron sync complete: 3 synced, 0 failed` |
| Sync failure | error | `Sync failed for user abc123...: Token expired` |
| API errors | error | `POST /api/v1/sync error: <details>` |
| Newsletter send failure | error | `POST /api/v1/newsletter error: <details>` |
| Database health check failure | error | `Database health check failed: <details>` |

### Docker logs

```bash
# Follow logs
docker logs -f xbook

# Last 100 lines
docker logs --tail 100 xbook

# Since a specific time
docker logs --since 2h xbook
```

## Key Metrics to Watch

| Metric | How to check | Alert threshold |
|--------|-------------|-----------------|
| Health status | `curl /api/v1/status` | `status != "ok"` |
| Database size | `ls -lh xbook.db` | > 500MB (unusual) |
| Disk space | `df -h` | < 10% free |
| Container restarts | `docker inspect --format='{{.RestartCount}}'` | > 3 in 1 hour |
| Sync errors | Check container logs for `error` | Any sync failure |

## External Monitoring (Optional)

For uptime monitoring, point any HTTP monitoring service at your health endpoint:

```
GET https://your-domain.com/api/v1/status
Expected: HTTP 200, body contains "ok"
```

Popular options:
- [UptimeRobot](https://uptimerobot.com) (free tier: 50 monitors, 5-minute intervals)
- [Better Uptime](https://betteruptime.com) (free tier available)
- [Checkly](https://www.checklyhq.com) (free tier: 5 checks)
