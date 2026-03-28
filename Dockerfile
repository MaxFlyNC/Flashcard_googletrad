# ── Stage 1 : Build React ────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --frozen-lockfile

COPY . .
RUN npm run build

# ── Stage 2 : Serve via Nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Config Nginx pour SPA React
COPY docker/nginx-app.conf /etc/nginx/conf.d/default.conf

# Copier le build
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
