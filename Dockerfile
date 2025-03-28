# Use Bun as the base image
FROM oven/bun:1.0.3

# Set the working directory
WORKDIR /app

# Copy package.json and lock file first for better caching
COPY package.json ./

# Install dependencies safely (disable symlinks)
RUN BUN_INSTALL_NO_SYMLINKS=1 bun install

# Copy the rest of the application
COPY . .

# Run the ES6 function using Babel Node
CMD ["bun", "run", "--bun", "@babel/node", "src/function.js"]
