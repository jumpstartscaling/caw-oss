FROM node:22-alpine

LABEL org.opencontainers.image.title="CAW"
LABEL org.opencontainers.image.description="Database-driven SSR framework"
LABEL org.opencontainers.image.authors="Christopher Amaya"
LABEL org.opencontainers.image.source="https://github.com/jumpstartscaling/caw"

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY server ./server
COPY views ./views
COPY public ./public
COPY scripts ./scripts
COPY schema.sql ./
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4321/health || exit 1

CMD ["sh", "-c", "node scripts/seed.mjs 2>/dev/null || true; exec node server/index.mjs"]
