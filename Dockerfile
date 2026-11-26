FROM node:22-bookworm-slim
WORKDIR /app
COPY . .
ENV PORT=8000
EXPOSE 8000
CMD ["node","server.js"]
