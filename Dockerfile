FROM oven/bun:1.0 as base

WORKDIR /app

# Copy package.json and lockfile (if using bun.lockb)
COPY package.json ./

# Install dependencies (Bun is much faster than npm/Yarn)
RUN bun install

# Copy the rest of the app
COPY . .

RUN bun run build
# Start the app
CMD ["bun", "start"]