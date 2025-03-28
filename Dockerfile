FROM oven/bun:1.0 as base

WORKDIR /app

# Copy package files first (for better caching)
COPY package.json ./

# Install dependencies
RUN bun install

# Copy the rest of the app (excluding node_modules)
COPY . .

# Debug: Show files before build
RUN ls -la

# Build the app (adjust this command based on your project)
RUN bun run build

# Debug: Show files after build (check if /dist exists)
RUN ls -la /app || echo "Dist folder not found!"

# Start the app (adjust CMD if needed)
CMD ["bun", "start"]