# Single-stage Dockerfile (builds inside container)
FROM node:16-alpine

WORKDIR /app

# 1. Copy everything
COPY . .

# 2. Install and build
RUN yarn install --frozen-lockfile && \
    yarn build && \
    yarn install --production && \
    rm -rf node_modules/.cache