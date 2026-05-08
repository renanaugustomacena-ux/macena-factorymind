# syntax=docker/dockerfile:1.7

# ============================================================================
# FactoryMind frontend — multi-stage Dockerfile.
# Stage 1: install + build Vite bundle with node:20-alpine.
# Stage 2: serve with nginx (production) or dev-preview with node (dev).
# Default target is `dev` to preserve HMR for local `docker compose up`.
# ============================================================================

FROM node:26-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

COPY . .

# ----- dev: runs `npm run dev` for HMR during docker-compose development -----
FROM node:26-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=builder /app /app
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ----- build: emits the static bundle -----
FROM builder AS build
RUN npm run build

# ----- production: serve static bundle with nginx (non-root) -----
# R-FRONTEND-DOCKERFILE-USER-001 / F-HIGH-007: container runs as the
# unprivileged `nginx` user (UID 101 in the upstream image). nginx writes
# its PID to /tmp because /run is root-owned in the base image. The
# server listens on 5173 (>1024 → no CAP_NET_BIND_SERVICE required).
FROM nginx:1.29-alpine AS production
LABEL org.opencontainers.image.title="factorymind-frontend"
LABEL org.opencontainers.image.licenses="MIT"
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'pid /tmp/nginx.pid;\n\
worker_processes auto;\n\
events { worker_connections 1024; }\n\
http {\n\
  include /etc/nginx/mime.types;\n\
  default_type application/octet-stream;\n\
  client_body_temp_path /tmp/client_body;\n\
  proxy_temp_path /tmp/proxy;\n\
  fastcgi_temp_path /tmp/fastcgi;\n\
  uwsgi_temp_path /tmp/uwsgi;\n\
  scgi_temp_path /tmp/scgi;\n\
  sendfile on;\n\
  server {\n\
    listen 5173;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / { try_files $uri $uri/ /index.html; }\n\
    location /api/ { proxy_pass http://factorymind-backend:3002; }\n\
    location /ws { proxy_pass http://factorymind-backend:3002; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }\n\
  }\n\
}\n' > /etc/nginx/nginx.conf \
 && rm -f /etc/nginx/conf.d/default.conf \
 && chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx \
 && chmod -R 755 /usr/share/nginx/html
USER nginx
EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=5s CMD wget --quiet --tries=1 --spider http://127.0.0.1:5173/ || exit 1
