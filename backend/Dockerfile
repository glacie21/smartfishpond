FROM node:20-alpine

WORKDIR /app

# Install dependency lebih dulu agar layer cache tidak batal tiap ubah kode.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000

# Jangan jalan sebagai root: bila proses bobol, penyerang tidak langsung root di container.
USER node

# Sehat = HTTP menjawab dan database terjangkau (/api/health balas 503 bila DB mati).
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null || exit 1

CMD ["node", "src/index.js"]
