# Multi-stage build for Notification Service
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package file
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build application
RUN npm run build

# Consolidate dist
RUN if [ -d /app/services/notification-service/dist ]; then \
      cp -r /app/services/notification-service/dist /app/_dist; \
    else \
      cp -r /app/dist /app/_dist; \
    fi

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package file
COPY package.json ./

# Install production dependencies only
RUN npm install --production

# Copy dist from builder
COPY --from=builder /app/_dist ./dist

# Expose port
EXPOSE 3053

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD curl -f http://localhost:3053/api/v1/health || exit 1

# Start application
CMD ["node", "dist/main.js"]
