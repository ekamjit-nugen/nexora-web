# Nexora Development Guide

## Environment Setup

### System Requirements

- **Node.js**: v20.0.0 or higher
- **npm**: v9.0.0 or higher
- **Docker**: v20.10+ (Desktop or CLI)
- **Docker Compose**: v1.29+
- **Git**: v2.0+
- **RAM**: 8GB minimum (for local Docker stack)
- **Disk Space**: 20GB recommended

### macOS Setup

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js 20
brew install node@20
brew link node@20 --force

# Install Docker Desktop
brew install --cask docker

# Verify installations
node --version    # Should be v20.x
npm --version     # Should be v9.x
docker --version
docker-compose --version
```

### Linux Setup (Ubuntu/Debian)

```bash
# Update package manager
sudo apt update

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installations
node --version
npm --version
docker --version
```

### Windows Setup (WSL2 Recommended)

```bash
# Use Windows Terminal with WSL2 (Ubuntu)
# Follow Linux setup above within WSL2 terminal

# Or use Docker Desktop for Windows with WSL2 backend
# https://docs.docker.com/desktop/install/windows-install/
```

---

## Project Setup

### 1. Clone Repository

```bash
git clone https://github.com/nugen-it/nexora.git
cd Nexora
```

### 2. Install Dependencies

```bash
# Clean install (removes old node_modules)
npm ci

# Or regular install
npm install

# Install dependencies for all workspaces
npm install --workspaces
```

### 3. Create Environment Files

**Root `.env` file:**

```bash
cp .env.example .env
```

**Edit `.env` with your values:**

```env
NODE_ENV=development
LOG_LEVEL=debug

# API Gateway
API_GATEWAY_PORT=3005
API_GATEWAY_HOST=0.0.0.0

# Database (local Docker)
MONGODB_URI=mongodb://root:nexora_dev_password@localhost:27017/nexora?authSource=admin
MONGODB_DATABASE=nexora

# Redis (local Docker)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=nexora_dev_password

# Elasticsearch (local Docker)
ELASTICSEARCH_HOST=localhost
ELASTICSEARCH_PORT=9200

# JWT
JWT_SECRET=nexora_jwt_dev_secret_change_in_production_use_strong_random_key
JWT_REFRESH_SECRET=nexora_jwt_refresh_dev_secret_change_in_production
JWT_EXPIRY_ACCESS=900
JWT_EXPIRY_REFRESH=604800

# Service Mesh
CONSUL_HOST=localhost
CONSUL_PORT=8500

# Optional: Cloud Services
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=nexora-dev

# Email
SENDGRID_API_KEY=
MAILHOG_HOST=localhost
MAILHOG_PORT=1025

# OAuth (Optional for development)
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_MICROSOFT_CLIENT_ID=
OAUTH_MICROSOFT_CLIENT_SECRET=

# AI Services
CLAUDE_API_KEY=
OLLAMA_HOST=http://localhost:11434

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:3002

# Monitoring
SENTRY_DSN=
PROMETHEUS_PORT=9090

# Logging
LOG_FORMAT=json
LOG_LEVEL=debug
```

### 4. Start Infrastructure

```bash
# Start all Docker containers
docker-compose up -d

# Verify all services are running
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

**Expected Services Output:**

```
NAME                     STATUS              PORTS
nexora-mongodb           Up 2 minutes        0.0.0.0:27017->27017/tcp
nexora-redis             Up 2 minutes        0.0.0.0:6379->6379/tcp
nexora-elasticsearch     Up 2 minutes        0.0.0.0:9200->9200/tcp, 0.0.0.0:9300->9300/tcp
nexora-kong              Up 2 minutes        0.0.0.0:8000->8000/tcp, 0.0.0.0:8443->8443/tcp, 0.0.0.0:8001->8001/tcp
nexora-consul            Up 2 minutes        0.0.0.0:8500->8500/tcp, 8600/udp
nexora-prometheus        Up 2 minutes        0.0.0.0:9090->9090/tcp
nexora-grafana           Up 2 minutes        0.0.0.0:3000->3000/tcp
nexora-kibana            Up 2 minutes        0.0.0.0:5601->5601/tcp
nexora-konga             Up 2 minutes        0.0.0.0:1337->1337/tcp
```

### 5. Seed Initial Data (Optional)

```bash
# Connect to MongoDB
mongosh 'mongodb://root:nexora_dev_password@localhost:27017'

# In MongoDB shell
use nexora
db.users.insertOne({
  email: "admin@nexora.io",
  firstName: "Admin",
  lastName: "User",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

---

## Running Services

### Start All Services (Development Mode)

```bash
# Terminal 1 - Watch all services
npm run dev

# Or start individual services:
cd services/api-gateway && npm run dev
cd services/auth-service && npm run dev
cd services/hr-service && npm run dev
# ... and so on
```

### Start Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start Next.js dev server
npm run dev

# Access at http://localhost:3000
```

---

## Useful Commands

### Build Commands

```bash
# Build all services
npm run build

# Build specific service
cd services/api-gateway && npm run build

# Build frontend
cd frontend && npm run build
```

### Testing Commands

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- services/auth-service

# Test coverage
npm run test:cov
```

### Linting & Formatting

```bash
# Lint all code
npm run lint

# Lint and fix issues
npm run lint -- --fix

# Format code  with Prettier
npm run format

# Format specific file
npx prettier --write "services/api-gateway/src/app.module.ts"
```

### Database Commands

```bash
# Connect to MongoDB
mongosh 'mongodb://root:nexora_dev_password@localhost:27017'

# View all databases
show dbs

# Use nexora database
use nexora

# View all collections
show collections

# Query users
db.users.find().pretty()

# Insert test data
db.users.insertOne({
  email: "test@nexora.io",
  firstName: "Test",
  lastName: "User",
  createdAt: new Date()
})

# Count documents
db.users.countDocuments()

# Drop collection
db.users.drop()
```

### Redis Commands

```bash
# Connect to Redis
docker-compose exec redis redis-cli

# View all keys
keys *

# Get value
get <key>

# Delete key
del <key>

# Flush all
flushall
```

### Service Information

```bash
# Check Consul services
curl http://localhost:8500/v1/catalog/services | jq

# Kong admin API
curl http://localhost:8001/services | jq

# Health check (API Gateway)
curl http://localhost:3005/health

# Metrics (Prometheus)
curl http://localhost:9090/api/v1/targets
```

---

## Docker Compose Services Reference

### Access Services

| Service | URL | Description |
|---------|-----|-------------|
| **MongoDB** | `mongodb://root:nexora_dev_password@localhost:27017` | Primary database |
| **Redis** | `localhost:6379` | Cache & sessions |
| **Elasticsearch** | `http://localhost:9200` | Search & logs |
| **Kong Proxy** | `http://localhost:8000` | API Proxy (port 80) |
| **Kong Admin** | `http://localhost:8001` | Kong Admin API |
| **Konga UI** | `http://localhost:1337` | Kong GUI (login: admin/admin) |
| **Consul** | `http://localhost:8500` | Service discovery |
| **Prometheus** | `http://localhost:9090` | Metrics |
| **Grafana** | `http://localhost:3000` | Dashboards (admin:admin) |
| **Kibana** | `http://localhost:5601` | Log visualization |
| **Redis Commander** | `http://localhost:8081` | Redis GUI |
| **Mailhog** | `http://localhost:8025` | Email testing |

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f nexora-mongodb

# Follow last 100 lines
docker-compose logs -f --tail=100 nexora-api-gateway

# No timestamps
docker-compose logs -f --no-log-prefix
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart nexora-mongodb

# Stop and start (clears some state)
docker-compose stop nexora-redis
docker-compose start nexora-redis
```

---

## Debugging

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "API Gateway",
      "outputCapture": "console",
      "program": "${workspaceFolder}/services/api-gateway/node_modules/@nestjs/cli/bin/nestjs.js",
      "args": ["start", "--watch"],
      "restart": true,
      "runtimeArgs": ["--nolazy"],
      "cwd": "${workspaceFolder}/services/api-gateway"
    }
  ]
}
```

Then press `F5` to start debugging.

### Console Logging

```typescript
// In development, use Winston logger
import { Logger } from '@nestjs/common';

const logger = new Logger('MyService');

logger.debug('Debug message');
logger.log('Info message');
logger.warn('Warning message');
logger.error('Error message');
```

### Monitor Queries

```bash
# MongoDB profiling
mongosh 'mongodb://root:nexora_dev_password@localhost:27017'
db.setProfilingLevel(1);  # Enable profiling
db.system.profile.find().sort({ ts: -1 }).limit(5).pretty()
```

---

## Common Issues & Fixes

### Port Already in Use

```bash
# Find process using port
lsof -i :3005

# Kill process
kill -9 <PID>

# Or change port in .env
API_GATEWAY_PORT=3006
```

### MongoDB Connection Failed

```bash
# Check MongoDB is running
docker-compose logs nexora-mongodb

# Restart MongoDB
docker-compose restart nexora-mongodb

# Verify connection
mongosh 'mongodb://root:nexora_dev_password@localhost:27017'
```

### Out of Memory

```bash
# Increase Docker memory
# Docker Desktop -> Preferences -> Resources -> Memory: 8GB

# Or on Linux
docker update --memory 4g <container_id>
```

### Permission Denied (Docker)

```bash
# Linux - add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# macOS - restart Docker Desktop
```

---

## Code Organization

### Service Structure

```
services/[service-name]/
├── src/
│   ├── main.ts                 # Entry point
│   ├── app.module.ts           # Main module
│   ├── app.service.ts          # Business logic
│   ├── app.controller.ts       # HTTP endpoints
│   ├── common/
│   │   ├── filters/            # Exception filters
│   │   ├── guards/             # Authentication guards
│   │   ├── middleware/         # Request middleware
│   │   └── pipes/              # Validation pipes
│   ├── modules/
│   │   ├── feature1/
│   │   │   ├── feature1.module.ts
│   │   │   ├── feature1.service.ts
│   │   │   ├── feature1.controller.ts
│   │   │   └── dto/
│   │   │       ├── create-feature1.dto.ts
│   │   │       └── update-feature1.dto.ts
│   │   └── feature2/
│   └── schemas/                # MongoDB schemas
├── test/
│   ├── app.e2e-spec.ts
│   └── fixtures/
├── package.json
├── tsconfig.json
├── Dockerfile
└── docker-compose.yml
```

### Validation DTOs

```typescript
// services/auth-service/src/modules/auth/dto/login.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

---

## Next Steps

1. ✅ **Infrastructure Setup** (You are here)
2. **Implement Auth Service** - User authentication, JWT, OAuth
3. **Implement API Gateway** - Request routing, rate limiting
4. **Implement HR Service** - Employee management, attendance
5. **Build Frontend** - Next.js application with design system

---

## Support & Resources

- 📚 [NestJS Documentation](https://docs.nestjs.com)
- 📚 [MongoDB Manual](https://docs.mongodb.com/manual/)
- 📚 [Redis Documentation](https://redis.io/documentation)
- 📚 [Kong Documentation](https://docs.konghq.com/)
- 💬 [Community Slack](https://nexora-community.slack.com)

---

**Last Updated**: March 18, 2026
**Version**: 1.0.0
