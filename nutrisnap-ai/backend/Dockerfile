# ==============================================================================
# NutriSnap AI Backend — Production Dockerfile
# Multi-stage build for optimal image size and security
# ==============================================================================

# --- Stage 1: Build & Compile TypeScript ---
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies for native compilation (e.g. sharp, argon2)
RUN apk add --no-cache python3 make g++

COPY package*.json tsconfig.json ./
COPY scripts/ ./scripts/
RUN npm ci

COPY src/ ./src/
RUN npm run build

# --- Stage 2: Minimal Production Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install runtime libraries required by native modules
RUN apk add --no-cache vips-dev

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild sharp argon2

# Copy compiled output and schema from builder
COPY --from=builder /app/dist ./dist

# Create directories for persistent storage with proper permissions
RUN mkdir -p /app/uploads /app/data && chown -R node:node /app

USER node

EXPOSE 4000

VOLUME ["/app/uploads", "/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["node", "dist/index.js"]
