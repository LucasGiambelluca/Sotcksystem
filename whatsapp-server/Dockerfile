# ==================== STAGE 1: Dependencies ====================
FROM node:20-alpine AS deps

WORKDIR /app

# Native deps needed by Baileys (libsignal, sharp, etc.)
RUN apk add --no-cache python3 make g++ libc6-compat git

COPY package.json package-lock.json ./

# Install ALL deps (dev included) for the build step
RUN npm ci

# ==================== STAGE 2: Builder ====================
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Compile TypeScript → dist/
RUN npm run build

# ==================== STAGE 3: Production deps only ====================
FROM node:20-alpine AS prod-deps

WORKDIR /app

RUN apk add --no-cache python3 make g++ libc6-compat git

COPY package.json package-lock.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# ==================== STAGE 4: Runner ====================
FROM node:20-alpine AS runner

WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Create directories for persistence
RUN mkdir -p /app/sessions /app/logs && chown -R nodejs:nodejs /app

# Copy production node_modules (no devDependencies)
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy compiled JS
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

COPY --chown=nodejs:nodejs package.json ./

# Default env vars
ENV NODE_ENV=production
ENV PORT=3001
ENV BAILEYS_SESSION_PATH=/app/sessions/auth_info_baileys
ENV BAILEYS_STORE_PATH=/app/sessions/baileys_store.json

# USER nodejs <- Commented out to fix EACCES on named volumes

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["node", "dist/index.js"]
