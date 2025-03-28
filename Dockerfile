# Use the official Bun image
FROM oven/bun:1.0

# Set the working directory
WORKDIR /app

# Copy package.json and bun.lockb first for better caching
COPY package.json bun.lockb ./

# Install dependencies using Bun
RUN bun install --production

# Copy the rest of the application code
COPY . .

# Set the command to run the function script
CMD ["bun", "src/function.js"]
