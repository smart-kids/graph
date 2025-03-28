FROM node:16-alpine

WORKDIR /app

COPY package.json yarn.lock ./

# Install ONLY production dependencies
RUN yarn install --production --frozen-lockfile

# Copy pre-built files (assumes you build locally first)
COPY dist/ ./dist

# Start normal Node (no babel-node in production)
CMD ["node", "dist/index.js"]