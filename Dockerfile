FROM node:16

WORKDIR /app
COPY . .

# Updated Yarn 4.x command (replaces --frozen-lockfile)
RUN npm install --legacy-peer-deps

COPY . .
CMD ["npm", "start"]