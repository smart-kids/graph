# Use Bun as the base image
FROM oven/bun:1.0

# Set the working directory
WORKDIR /app

# Copy package.json and lock file first
COPY package.json bun.lock ./

# Install dependencies safely
RUN bun install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Manually rebuild native modules like argon2
RUN bun x npm rebuild argon2

# Run the ES6 function using Babel Node
CMD ["bun", "run", "--bun", "@babel/node", "src/function.js"]
