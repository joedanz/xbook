# syntax=docker/dockerfile:1

# --- Base ---
FROM node:22-alpine AS base
WORKDIR /app

# --- Dependencies ---
FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY web/package.json web/package-lock.json ./web/
RUN npm ci && cd web && npm ci

# --- Builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY . .
RUN cd web && npm run build
# Ensure web/public exists (even if empty) so COPY in runner won't fail
RUN mkdir -p web/public

# --- Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone server (includes only needed node_modules)
COPY --from=builder /app/web/.next/standalone ./
# Copy static assets (not included in standalone)
COPY --from=builder /app/web/.next/static ./web/.next/static
# Copy public assets (directory guaranteed to exist via mkdir in builder)
COPY --from=builder /app/web/public ./web/public
# Copy better-sqlite3 and its native addon loader deps from builder.
# Standalone output strips native build sources, so we copy the full packages.
COPY --from=builder /app/web/node_modules/better-sqlite3 ./web/node_modules/better-sqlite3
COPY --from=builder /app/web/node_modules/bindings ./web/node_modules/bindings
COPY --from=builder /app/web/node_modules/file-uri-to-path ./web/node_modules/file-uri-to-path

# Create data directory for SQLite
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DB_PATH="/data/xbook.db"
ENV TOKEN_FILE_PATH="/data/.tokens.json"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/status',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "web/server.js"]
