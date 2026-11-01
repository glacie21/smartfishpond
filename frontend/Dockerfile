# Build context = root repo (lihat docker-compose.yml): proyek memakai npm
# workspaces, jadi satu-satunya package-lock.json ada di root.

# ---------- Tahap build ----------
FROM node:24-alpine AS build

WORKDIR /app

# package.json backend ikut disalin karena lockfile mencakup semua workspace.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend

COPY frontend/ frontend/

# Variabel VITE_ dibaca saat build, bukan saat runtime.
ARG VITE_API_BASE_URL=""
ARG VITE_SOCKET_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build --workspace frontend

# ---------- Tahap serve ----------
FROM nginx:alpine

COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
