# Servicio realtime NestJS + Socket.IO.
#
# Multi-stage: dependencias de desarrollo para compilar TypeScript y una imagen
# final mínima que solo incluye dependencias de producción y `dist/`.
# El contenedor corre como usuario no root (`node`).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# El usuario `node` (uid 1000) ya existe en la imagen oficial.
USER node

EXPOSE 3000

# `node` está garantizado en la imagen; evita depender de wget/curl.
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
