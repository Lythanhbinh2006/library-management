# ---- Giai đoạn 1: cài dependency ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
 && npm cache clean --force

# ---- Giai đoạn 2: image chạy thật (non-root) ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public

# Hardening: chạy bằng user 'node' (UID 1000), không phải root.
# File mã nguồn thuộc root và chỉ đọc -> tiến trình ứng dụng không ghi đè được code.
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
