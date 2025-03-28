# Use the official Node.js image as the base
FROM node:16

# Set the working directory
WORKDIR /app

# Copy package.json and yarn.lock first
COPY package.json yarn.lock ./

# Install dependencies using yarn
RUN yarn install

# Copy the rest of the application
COPY . .

# Manually rebuild native modules like argon2 (if needed)
RUN yarn rebuild argon2

# Run the application using Node.js
CMD ["node", "src/function.js"]
