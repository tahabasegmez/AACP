# AACP backend imajı — mimariden bağımsız (linux/amd64 ve linux/arm64).
# Aynı Dockerfile Raspberry Pi 5'te, kurumsal sunucuda veya kiralık bir VPS'te
# değişiklik yapmadan çalışır: `docker build` hedef mimariye göre derler.

# --- derleme aşaması ---------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 native derleme gerektirebilir (hazır ikili yoksa).
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Üretim bağımlılıklarını ayrı bir ağaçta hazırla (dev bağımlılıkları taşınmasın).
RUN npm prune --omit=dev

# --- çalıştırma aşaması ------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DATA_DIR=/data

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Kalıcı veri (SQLite + shows.json) konteyner dışında yaşar.
VOLUME ["/data"]
EXPOSE 8080

# root olmayan kullanıcı — imajda hazır gelen `node` kullanıcısı.
RUN mkdir -p /data && chown -R node:node /data
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
