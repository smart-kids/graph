FROM node:16-alpine

WORKDIR /app

# 1. Copy package files first for caching
COPY package.json yarn.lock ./

# 2. Install dependencies (including modern babel-cli)
RUN yarn install --frozen-lockfile && \
    yarn add @babel/core @babel/cli @babel/preset-env --dev

# 3. Copy babel config and source files
COPY . .

# 4. Build with modern babel
RUN npx babel src --out-dir dist --source-maps && \
    node copy-package.js

# 5. Verify build
RUN ls -la dist/ || { echo "Build failed!"; exit 1; }