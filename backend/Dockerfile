# syntax=docker/dockerfile:1.7

# ============================================================================
# FactoryMind backend — multi-stage Docker build.
#   - builder: installs dependencies with a cacheable layer
#   - runtime: minimal distroless-like node:20-alpine, non-root, HEALTHCHECK
# ============================================================================

FROM node:24-alpine AS builder
WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
COPY package-lock.json* ./

# Tolerant install: lockfile preferred but allow fresh resolution on template
# boot before a lock is committed; pinned build uses `npm ci`.
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --no-audit --no-fund; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi

COPY src ./src
COPY tests ./tests

# ---------------------------------------------------------------------- runtime
FROM node:24-alpine AS runtime

LABEL org.opencontainers.image.title="factorymind-backend"
LABEL org.opencontainers.image.description="Industrial IoT monitoring backend for Italian manufacturing SMEs"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://example.com/factorymind"

ENV NODE_ENV=production \
    APP_PORT=3002 \
    NODE_OPTIONS="--enable-source-maps --max-old-space-size=512"

RUN apk add --no-cache tini ca-certificates && \
    addgroup -g 1001 factorymind && \
    adduser -D -u 1001 -G factorymind factorymind && \
    # Rimuovi npm dall'immagine runtime: il processo produce usa solo `node`,
    # tenere npm espone le CVE transitive di tar/glob/minimatch che Trivy
    # flagga come HIGH anche se non sono sul path di esecuzione.
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg 2>/dev/null || true

WORKDIR /app

COPY --from=builder --chown=factorymind:factorymind /app/node_modules ./node_modules
COPY --from=builder --chown=factorymind:factorymind /app/src ./src
COPY --chown=factorymind:factorymind package.json ./

USER factorymind

EXPOSE 3002

HEALTHCHECK --interval=20s --timeout=5s --start-period=25s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:3002/api/health', r => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
