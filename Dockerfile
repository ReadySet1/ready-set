# syntax=docker/dockerfile:1.7
#
# Multi-stage production image for the Ready Set Next.js app.
# - Uses Next.js standalone output (next.config -> output: "standalone").
# - Debian "bookworm-slim" (glibc) base so Prisma's default `native` engine
#   target works without adding binaryTargets to schema.prisma. Builds and runs
#   on the SAME base image + arch, so this image is correct on both x86_64 and
#   arm64 (the Hetzner ARM target box) when built natively on that host.
# - pnpm pinned via corepack to match package.json "packageManager".
#
# Build is the memory-heavy step: the app's `build` script sets
# NODE_OPTIONS=--max-old-space-size=4096. On an 8 GB host make sure swap is
# enabled (see the migration plan) or the build can be OOM-killed.

ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- deps: install node_modules only (cached layer) ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

# Prisma needs openssl at install/generate time.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Skip the postinstall `prisma generate` here; we run it explicitly in builder
# once the full schema is present.
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
RUN corepack enable

COPY package.json pnpm-lock.yaml .npmrc* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- builder: prisma generate + next build ----------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# --- Build-time public env (Next.js inlines NEXT_PUBLIC_* at build) ---
# Set these as Build Args in Dokploy (Application -> Build -> Build Args).
# They MUST be present at build time or the client bundle ships with blanks.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES
ARG NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_FF_USE_REALTIME_TRACKING
ARG NEXT_PUBLIC_CATER_VALLEY_API_URL
ARG NEXT_PUBLIC_CATER_VALLEY_PARTNER_HEADER
# Sanity: src/sanity/env.ts throws at module-eval if these are missing, which
# breaks `next build`'s "Collecting page data" step (e.g. /api/guides/[slug]).
ARG NEXT_PUBLIC_SANITY_PROJECT_ID
ARG NEXT_PUBLIC_SANITY_DATASET
ARG NEXT_PUBLIC_SANITY_API_VERSION
# Some pages may read these during `next build` (static generation / data collect).
ARG DATABASE_URL
ARG DIRECT_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES=$NEXT_PUBLIC_FF_USE_REALTIME_LOCATION_UPDATES \
    NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD=$NEXT_PUBLIC_FF_USE_REALTIME_ADMIN_DASHBOARD \
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT \
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=$NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME \
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_FF_USE_REALTIME_TRACKING=$NEXT_PUBLIC_FF_USE_REALTIME_TRACKING \
    NEXT_PUBLIC_CATER_VALLEY_API_URL=$NEXT_PUBLIC_CATER_VALLEY_API_URL \
    NEXT_PUBLIC_CATER_VALLEY_PARTNER_HEADER=$NEXT_PUBLIC_CATER_VALLEY_PARTNER_HEADER \
    NEXT_PUBLIC_SANITY_PROJECT_ID=$NEXT_PUBLIC_SANITY_PROJECT_ID \
    NEXT_PUBLIC_SANITY_DATASET=$NEXT_PUBLIC_SANITY_DATASET \
    NEXT_PUBLIC_SANITY_API_VERSION=$NEXT_PUBLIC_SANITY_API_VERSION \
    DATABASE_URL=$DATABASE_URL \
    DIRECT_URL=$DIRECT_URL \
    HUSKY=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=true

# `pnpm build` runs `prisma generate && next build` (both with the 4 GB heap).
RUN pnpm build

# ---------- runner: minimal standalone server ----------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as non-root.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone output bundles a minimal node_modules + server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# The Prisma client + native query engine are pulled into .next/standalone by
# next.config.js `outputFileTracingIncludes` (the standalone copy above already
# carries them at their resolved pnpm path), so no separate engine COPY here.

USER nextjs
EXPOSE 3000

# Lightweight container healthcheck (Dokploy/Swarm reads this). /api/health
# returns the package.json version per the project docs.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
