# Production image for the DhruvSetu website (Next.js).
# Build from the frontend folder:
#   docker build --build-arg API_URL=http://backend:8000 -t dhruvsetu-frontend frontend
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Where this site reaches the API. The address is written into the build (the
# /api pass-through in next.config.ts), so it has to be given here, and the
# image has to be built again when it changes.
ARG API_URL=http://backend:8000
ENV API_URL=${API_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && rm -rf .next/cache

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/next.config.ts ./
COPY --from=build /app/public ./public
COPY --from=build --chown=node:node /app/.next ./.next
# Used again at run time for the pages the server renders itself.
ARG API_URL=http://backend:8000
ENV API_URL=${API_URL}
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/image-credits').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
