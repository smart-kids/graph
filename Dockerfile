FROM node:16-alpine

WORKDIR /app

# 1. Copy package files first for better caching
COPY package.json yarn.lock ./

# 2. Install dependencies
RUN yarn install --frozen-lockfile

# 3. Copy all source files
COPY . .

# 4. Build the app (creates dist folder)
RUN yarn build

# 5. Verify dist folder exists
RUN ls -la dist/ || { echo "Error: dist folder missing after build!"; exit 1; }

# 6. Start the app
CMD ["yarn", "start"]