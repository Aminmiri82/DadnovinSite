#############################
# Unified Multi-Stage Dockerfile
#############################

########### DEVELOPMENT STAGE ###########
FROM node:18 AS dev
# Install build dependencies (Debian-based)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Copy package files and install dependencies
COPY package*.json ./
RUN npm install
# Copy Prisma schema and generate Prisma client
COPY prisma/ ./prisma/
RUN npx prisma generate
# Copy the rest of the project files
COPY . .
# Create a data directory if it doesn't exist
RUN mkdir -p data

# Enable polling for file changes (Windows compatibility)
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true

# Set environment variable for development
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]

########### PRODUCTION STAGES ###########
# Use an Alpine-based image for a smaller production image
FROM node:18-alpine AS prod_base
WORKDIR /app

# Install production build dependencies
FROM prod_base AS prod_deps
RUN apk add --no-cache libc6-compat python3 make g++ gcc
COPY package.json package-lock.json* ./
RUN npm ci
# Create prisma directory and copy schema files
RUN mkdir -p ./prisma
COPY prisma/ ./prisma/
RUN npx prisma generate

# Build the app
FROM prod_base AS prod_builder
WORKDIR /app
COPY --from=prod_deps /app/node_modules ./node_modules
COPY --from=prod_deps /app/node_modules/.prisma ./node_modules/.prisma
COPY . .
# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Final production runner image
FROM prod_base AS prod_runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Create a non-root user for better security
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# Copy production artifacts
COPY --from=prod_builder /app/public ./public
COPY --from=prod_builder /app/package.json ./package.json
COPY --from=prod_builder /app/.next/standalone ./
COPY --from=prod_builder /app/.next/static ./.next/static
# Copy Prisma related files
COPY --from=prod_builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prod_builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=prod_builder /app/prisma ./prisma
# Set file permissions and switch user
RUN chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
