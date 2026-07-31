# ChatHermes — single image running orchestrator, web, and the shared agent proxy.
#
# One image rather than three keeps the SQLite file on one filesystem and makes
# this deployable to platforms that only accept a single container (Railway,
# Render, Fly, CapRover, Coolify, Dokploy). docker-compose.yml runs this same
# image; there is no separate build for compose.
#
#   docker build -t chathermes .
#   docker run -p 7000:7000 -v chathermes-data:/data --env-file .env chathermes

FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# ── deps ────────────────────────────────────────────────────────────
# Copied separately so a source-only change does not reinstall packages.
FROM base AS deps
COPY orchestrator/package.json orchestrator/
COPY web/package.json web/
RUN cd orchestrator && bun install --no-save
RUN cd web && bun install --no-save

# ── build web ───────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/web/node_modules web/node_modules
COPY web web
# Next reads env at build time for statically-rendered pages; runtime values
# still win because every data route is dynamic.
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd web && bun run build

# ── runtime ─────────────────────────────────────────────────────────
FROM base AS runtime

# tini reaps the child processes we spawn below; wget backs the healthcheck.
RUN apk add --no-cache tini wget

ENV NODE_ENV=production \
    DATA_ROOT=/data \
    PORT=7010 \
    WEB_PORT=7000 \
    ORCH_URL=http://127.0.0.1:7010 \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/orchestrator/node_modules orchestrator/node_modules
COPY orchestrator orchestrator
COPY --from=build /app/web/.next web/.next
COPY --from=deps /app/web/node_modules web/node_modules
COPY web/package.json web/next.config.ts web/
COPY web/public web/public

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && mkdir -p /data

VOLUME ["/data"]
EXPOSE 7000 7010

# Web is the public surface, so that is what readiness follows.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${WEB_PORT}/api/status >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/usr/local/bin/entrypoint.sh"]
