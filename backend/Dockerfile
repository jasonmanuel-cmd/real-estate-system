FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
# npm workspaces: dependencies live in the ROOT package.json/lockfile.
# Build context is ./backend, so copy the root manifests from a build arg.
ARG BUILD_CONTEXT=.
COPY ${BUILD_CONTEXT}/package.json ${BUILD_CONTEXT}/package-lock.json* ./
COPY ${BUILD_CONTEXT}/backend/package.json ./backend/package.json
RUN npm ci --workspace=backend --include=dev

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/
WORKDIR /app/backend

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app/backend

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built files
COPY --from=builder --chown=nodejs:nodejs /app/backend/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/backend/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/backend/prisma ./prisma

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

USER nodejs

EXPOSE 3001

# Run migrations and start server
CMD npx prisma migrate deploy && node dist/server.js
