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
COPY templates templates
# Download gradle-wrapper.jar for vendored wrapper template
RUN mkdir -p templates/fabric-wrapper/gradle/wrapper && \
    curl -sL "https://raw.githubusercontent.com/gradle/gradle/v8.10.2/gradle/wrapper/gradle-wrapper.jar" \
    -o templates/fabric-wrapper/gradle/wrapper/gradle-wrapper.jar || true
# Create certs directory structure (certificate will be added via secret mount or build arg in production)
RUN mkdir -p ./certs
RUN npm install && \
    npm run build -w @themodgenerator/spec && \
    npm run build -w @themodgenerator/db -w @themodgenerator/validator -w @themodgenerator/gcp -w @themodgenerator/generator && \
    npm run build -w @themodgenerator/builder

FROM deps
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/builder/dist ./apps/builder/dist
COPY --from=builder /app/apps/builder/package.json ./apps/builder/
# Copy certs directory (may be empty, code handles missing cert file gracefully)
RUN mkdir -p /certs
COPY --from=builder /app/certs /certs
CMD ["node", "apps/builder/dist/index.js"]
