FROM node:18

WORKDIR /app
COPY package.json ./

# Updated Yarn 4.x command (replaces --frozen-lockfile)
RUN npm install --legacy-peer-deps

COPY . .
CMD ["npm", "start"]