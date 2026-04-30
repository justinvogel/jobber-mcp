FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build && npm prune --production

FROM node:20-alpine
WORKDIR /app

# Non-root user.
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Persist tokens outside the container by mounting a volume here.
RUN mkdir -p /data && chown -R app:app /app /data
USER app
ENV JOBBER_TOKEN_FILE=/data/.jobber-tokens.json
ENV PORT=3000
EXPOSE 3000

# Default to HTTP mode — for stdio mode, override the CMD.
CMD ["node", "dist/http.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/healthz || exit 1
