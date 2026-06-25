# Runtime-only image — the frontend and backend are built natively by
# GitHub Actions before this Dockerfile runs, so no pnpm/Vite/esbuild here.
# This keeps the image small and avoids QEMU emulation failures on ARM.
FROM node:24-alpine

WORKDIR /app

# Pre-built Express server bundle
COPY artifacts/api-server/dist ./dist

# Pre-built Vite static frontend
COPY artifacts/ha-yaml/dist/public ./public

COPY ha-addon/run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 8099

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8099/api/healthz || exit 1

CMD ["/run.sh"]
