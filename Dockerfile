FROM node:18

# Use specific Yarn version (either modern or classic)
RUN corepack enable && \
    corepack prepare yarn@3.6.1 --activate  # or yarn@classic

WORKDIR /app
COPY package.json yarn.lock ./

# Updated Yarn 4.x command (replaces --frozen-lockfile)
RUN yarn install --immutable

COPY . .
CMD ["yarn", "start"]