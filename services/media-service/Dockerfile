# Multi-stage build for Media Service
FROM node:20-alpine AS builder

WORKDIR /app

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

# Copy package file
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build application
RUN npm run build

# Consolidate dist
RUN if [ -d /app/services/media-service/dist ]; then \
      cp -r /app/services/media-service/dist /app/_dist; \
    else \
      cp -r /app/dist /app/_dist; \
    fi

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install curl for health checks + ffmpeg for video processing
RUN apk add --no-cache curl ffmpeg

# Copy package file
COPY package.json ./

# Install production dependencies only
RUN npm install --production

# Copy dist from builder
COPY --from=builder /app/_dist ./dist

# Expose port
EXPOSE 3052

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD curl -f http://localhost:3052/api/v1/health || exit 1

# Start application
CMD ["node", "dist/main.js"]
