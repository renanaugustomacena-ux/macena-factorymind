# syntax=docker/dockerfile:1.7
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --no-audit --no-fund; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi

COPY simulator.js config.sample.json ./

USER node

CMD ["node", "simulator.js"]
