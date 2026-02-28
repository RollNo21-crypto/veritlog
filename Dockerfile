# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install native build tools for node packages that require compilation
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: Build the application ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Skip env validation at build time (env vars injected at runtime by ECS)
ENV SKIP_ENV_VALIDATION=1
ENV NODE_ENV=production

RUN npm run build

# ─── Stage 3: Production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is created by `output: "standalone"` in next.config.js
CMD ["node", "server.js"]
