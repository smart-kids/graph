FROM node
WORKDIR /app
COPY ./ ./
RUN yarn
CMD ["yarn", "dev"]