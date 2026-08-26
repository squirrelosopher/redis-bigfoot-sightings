# Dependencies are installed in their own stage so that the runtime image keeps
# only what it needs, and so a source-only change does not invalidate the
# (slow) install layer.
FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev


FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    SERVER_PORT=8080

WORKDIR /app

# `node` is an unprivileged user that ships with the base image.
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node public ./public
COPY --chown=node:node docs ./docs
COPY --chown=node:node data ./data

USER node

EXPOSE 8080

# Uses the liveness probe rather than a bare TCP check, so a wedged event loop
# is reported as unhealthy instead of merely "port open".
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.SERVER_PORT || 8080) + '/health/live').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

# Signals reach the process directly in exec form, which is what makes the
# graceful shutdown handler run on `docker stop`.
CMD ["node", "src/server.js"]
