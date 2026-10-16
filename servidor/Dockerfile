FROM node:20-alpine
WORKDIR /app
COPY package.json server.js reset-password.js ./
COPY public ./public
ENV NODE_ENV=production DATA_DIR=/app/data PORT=3000
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node","server.js"]
