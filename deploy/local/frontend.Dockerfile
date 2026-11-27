FROM node:22-bookworm-slim
WORKDIR /app
COPY EDU_Frontend/package.json EDU_Frontend/package-lock.json ./
RUN npm ci
COPY EDU_Frontend/ ./
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--strictPort"]
