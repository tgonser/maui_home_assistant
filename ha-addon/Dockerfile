# ── Stage 1: build ─────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

RUN npm install -g pnpm@10.26.1

WORKDIR /workspace

# Copy manifests first for layer-cache efficiency
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY lib/api-zod/package.json       ./lib/api-zod/
COPY lib/api-spec/package.json      ./lib/api-spec/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/db/package.json            ./lib/db/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/ha-yaml/package.json    ./artifacts/ha-yaml/

RUN pnpm install --frozen-lockfile

# Copy source
COPY lib                ./lib
COPY artifacts/api-server ./artifacts/api-server
COPY artifacts/ha-yaml    ./artifacts/ha-yaml

# The @assets alias in vite.config.ts points here; create it so the
# build doesn't fail if no component actually imports from @assets.
RUN mkdir -p attached_assets

# Build shared libs (composite TS build)
RUN pnpm run typecheck:libs 2>&1 || true

# Build frontend — BASE_PATH=/ so all asset paths are root-relative;
# PORT is only used for the dev-server config (not the build output)
RUN PORT=3000 BASE_PATH=/ pnpm --filter @workspace/ha-yaml run build

# Build Express server
RUN pnpm --filter @workspace/api-server run build

# ── Stage 2: runtime ────────────────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app

COPY --from=builder /workspace/artifacts/api-server/dist ./dist
COPY --from=builder /workspace/artifacts/ha-yaml/dist/public ./public

COPY ha-addon/run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 8099

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8099/api/healthz || exit 1

CMD ["/run.sh"]
