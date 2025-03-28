# Start from a Node.js base image (or your preferred base)
FROM node:18

# Install Yarn (modern approach)
RUN corepack enable && \
    corepack prepare yarn@stable --activate

# Alternatively, classic Yarn installation:
# RUN npm install -g yarn

# Your existing Dockerfile steps...
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .

# Your application's startup command
CMD ["yarn", "start"]