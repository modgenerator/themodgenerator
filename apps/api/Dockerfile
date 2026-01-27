# Build from repo root: docker build -f apps/api/Dockerfile .
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages packages
COPY apps apps
COPY tsconfig.base.json ./
# Create certs directory structure (certificate will be added via secret mount or build arg in production)
RUN mkdir -p ./certs
RUN npm install && \
    npm run build -w @themodgenerator/spec && \
    npm run build -w @themodgenerator/db -w @themodgenerator/validator -w @themodgenerator/gcp && \
    npm run build -w @themodgenerator/api

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# Copy certs directory (may be empty, code handles missing cert file gracefully)
RUN mkdir -p /certs
COPY --from=builder /app/certs /certs
RUN cp -r /app/node_modules /app/apps/api/ 2>/dev/null || true
EXPOSE 8080
CMD ["node", "apps/api/dist/index.js"]
