FROM node:20-alpine

WORKDIR /app

# Install dependency lebih dulu agar layer cache tidak batal tiap ubah kode.
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/index.js"]
