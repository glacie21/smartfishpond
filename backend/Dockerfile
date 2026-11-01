# Build context = root repo (lihat docker-compose.yml): proyek memakai npm
# workspaces, jadi satu-satunya package-lock.json ada di root.
FROM node:24-alpine

WORKDIR /app

# Manifest dulu agar layer dependency tidak batal tiap ubah kode.
# package.json frontend ikut disalin karena lockfile mencakup semua workspace.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --omit=dev && npm cache clean --force

COPY backend/src backend/src

WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 4000

# Jangan jalan sebagai root: bila proses bobol, penyerang tidak langsung root di container.
USER node

# Sehat = HTTP menjawab dan database terjangkau (/api/health balas 503 bila DB mati).
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null || exit 1

CMD ["node", "src/index.js"]
