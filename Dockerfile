# Stage 1: Build
FROM node:16-alpine as builder

WORKDIR /app

# Copy dependency files first (for caching)
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy all files (exclude node_modules via .dockerignore)
COPY . .

# Build the app
RUN yarn build

# Stage 2: Runtime (optimized for production)
FROM node:16-alpine

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Verify files (optional)
RUN ls -la