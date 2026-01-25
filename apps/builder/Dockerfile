# Build from repo root: docker build -f apps/builder/Dockerfile .
# Image has Node + Java 21 + Gradle for Fabric mod builds.
FROM eclipse-temurin:21-jdk-jammy AS deps
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates unzip && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
RUN curl -sL "https://services.gradle.org/distributions/gradle-8.10.2-bin.zip" -o /tmp/gradle.zip \
  && unzip -q /tmp/gradle.zip -d /opt && mv /opt/gradle-8.10.2 /opt/gradle && rm /tmp/gradle.zip
ENV PATH="/opt/gradle/bin:${PATH}"

FROM deps AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages packages
COPY apps apps
COPY tsconfig.base.json ./
RUN npm install && npm run build -w @themodgenerator/spec -w @themodgenerator/db -w @themodgenerator/validator -w @themodgenerator/gcp -w @themodgenerator/generator && npm run build -w apps/builder

FROM deps
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/builder/dist ./apps/builder/dist
COPY --from=builder /app/apps/builder/package.json ./apps/builder/
CMD ["node", "apps/builder/dist/index.js"]
