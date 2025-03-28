# Stage 1: Build
FROM oven/bun:1.0-slim as builder

WORKDIR /app

# Copy dependency files first (for caching)
COPY package.json bun.lockb* ./

# Install dependencies (production-only for deployment)
RUN bun install --frozen-lockfile --production

# Copy all files (exclude node_modules via .dockerignore)
COPY . .

# Build the app (adjust for your framework)
RUN bun run build

# Stage 2: Runtime (optimized for production)
FROM oven/bun:1.0-slim

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Start command (adjust for your app)
CMD ["bun", "run", "start"]