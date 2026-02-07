FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/webclaw/package.json apps/webclaw/package.json
RUN pnpm install --frozen-lockfile --prod=false

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/webclaw/node_modules ./apps/webclaw/node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
WORKDIR /app

# Preserve monorepo structure for module resolution
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=builder --chown=appuser:appgroup /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy webclaw app structure
COPY --from=builder --chown=appuser:appgroup /app/apps/webclaw/package.json ./apps/webclaw/package.json
COPY --from=builder --chown=appuser:appgroup /app/apps/webclaw/dist ./apps/webclaw/dist
COPY --from=builder --chown=appuser:appgroup /app/apps/webclaw/server-start.js ./apps/webclaw/server-start.js

# Copy all node_modules (both root and app-level)
COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=deps --chown=appuser:appgroup /app/apps/webclaw/node_modules ./apps/webclaw/node_modules

USER appuser
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app/apps/webclaw
EXPOSE 3000
CMD ["node", "server-start.js"]
