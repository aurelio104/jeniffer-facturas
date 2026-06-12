# Jeniffer — imagen mínima: API + frontend estático + SQLite en volumen (/data)
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV SERVE_FRONTEND=1
ENV DATA_DIR=/data
ENV PORT=8000

RUN apk add --no-cache tini openssl

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/src/generated ./backend/src/generated
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY scripts/koyeb-start.sh ./scripts/koyeb-start.sh
RUN chmod +x ./scripts/koyeb-start.sh

EXPOSE 8000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/scripts/koyeb-start.sh"]
