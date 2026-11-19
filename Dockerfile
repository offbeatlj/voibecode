# Stage 1: Build monorepo workspaces + package IDE artifacts (.vsix & Antigravity .zip)
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/worker/package.json ./packages/worker/
COPY packages/web/package.json ./packages/web/
COPY packages/extension/package.json ./packages/extension/
COPY packages/antigravity-plugin/package.json ./packages/antigravity-plugin/

RUN npm install --no-audit --no-fund

COPY packages ./packages
COPY scripts ./scripts

RUN npm run build:shared && npm run build --workspace=packages/antigravity-plugin && npm run package:all && npm run build --workspace=packages/web

# Stage 2: Minimal zero-dependency Node 22 production image
FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/packages/web/dist ./packages/web/dist
COPY --from=builder /app/packages/server/server.mjs ./packages/server/server.mjs

EXPOSE 3000

CMD ["node", "packages/server/server.mjs"]
