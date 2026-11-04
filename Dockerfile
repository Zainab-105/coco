# Production image for the COCO store (storefront + admin in one Next.js server).
# Build:  docker build --build-arg DATABASE_URL=... --build-arg PAYLOAD_SECRET=... -t coco .
# Run:    docker run -p 3000:3000 --env-file .env coco
# Database migrations in src/migrations run automatically when the server boots (prodMigrations).

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Pages are pre-rendered at build time from the database, so DATABASE_URL must be reachable
# during the build (pending migrations are applied then as well).
ARG DATABASE_URL
ARG PAYLOAD_SECRET
ARG NEXT_PUBLIC_SERVER_URL
ARG NEXT_PUBLIC_MEDIA_URL
ARG NEXT_PUBLIC_WHATSAPP_NUMBER
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG GOOGLE_SITE_VERIFICATION
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Nightly backups and restore drills: docker build --target backup -t coco-backup .
# See docs/ops/RUNBOOK.md. Must come before the final stage so a plain build still produces the app.
FROM base AS backup
WORKDIR /app
RUN apk add --no-cache postgresql17-client
RUN npm init -y >/dev/null && npm install --omit=dev --no-audit --no-fund pg @aws-sdk/client-s3
COPY scripts/backup-db.mjs scripts/restore-drill.mjs ./scripts/
CMD ["node", "scripts/backup-db.mjs"]

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
