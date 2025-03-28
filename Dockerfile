FROM node:16-alpine

WORKDIR /app

# Copy package files first (better caching)
COPY package.json yarn.lock ./

# Install dependencies (include devDependencies for babel)
RUN yarn install --frozen-lockfile

# Copy all source files
COPY . .

# Verify babel-node is available
RUN yarn list babel-node || { echo "babel-node not found!"; exit 1; }

# Start with babel-node (development)
CMD ["yarn", "run", "babel-node", "src/function.js"]  # Adjust entry point as needed