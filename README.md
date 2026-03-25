# Nexora — Unified Enterprise IT Operations Platform

## 🚀 Project Status: Phase 1 - Foundation & Microservices Setup

This is the complete microservices-based implementation of Nexora, a unified IT operations platform designed to consolidate 10+ fragmented SaaS tools into one cohesive system.

### Project Structure

```
nexora/
├── frontend/                    # Next.js 14 web application
├── services/                    # Microservices (20+ services)
│   ├── api-gateway/            # Kong-based API Gateway
│   ├── auth-service/           # Authentication & Authorization
│   ├── hr-service/             # HR Operations
│   ├── attendance-service/     # Attendance & Shift Management
│   ├── payroll-service/        # Payroll & Compensation
│   ├── project-service/        # Project Management
│   ├── task-service/           # Task Management
│   ├── board-service/          # Kanban/Scrum Boards
│   ├── crm-service/            # Client Management & CRM
│   ├── invoice-service/        # Invoicing & Billing
│   ├── expense-service/        # Expense Management
│   ├── document-service/       # Knowledge Base & Wiki
│   ├── asset-service/          # IT Asset Management
│   ├── recruitment-service/    # Recruitment & ATS
│   ├── notification-service/   # Notifications & Reminders
│   ├── realtime-service/       # WebSocket Gateway (Chat, Presence)
│   ├── analytics-service/      # Reports & Analytics
│   ├── ai-service/             # AI Features & Automation
│   ├── file-service/           # File Upload/Download
│   └── integration-service/    # Third-party Integrations
├── packages/                    # Shared libraries
│   ├── types/                  # TypeScript type definitions
│   ├── shared/                 # Shared utilities
│   └── utils/                  # Common helper functions
├── infrastructure/              # Infrastructure as Code
│   ├── docker-compose.yml      # Local development stack
│   ├── k8s/                    # Kubernetes manifests
│   ├── mongo-init.js           # MongoDB initialization
│   ├── prometheus.yml          # Monitoring configuration
│   └── logstash.conf           # Log aggregation
└── nexora-complete-prd.md      # Product Requirements Document
```

### Quick Start

#### Prerequisites
- Docker & Docker Compose 20.10+
- Node.js 20+ (for local development without Docker)
- MongoDB 7+ (if running without Docker)
- Redis 7+ (if running without Docker)

#### 1. Start Infrastructure (Local Development)

```bash
# Start all infrastructure services (MongoDB, Redis, Elasticsearch, Kong, Consul, Monitoring, etc.)
docker-compose up -d

# Verify services are running
docker-compose ps

# View logs
docker-compose logs -f
```

**Available Services:**
- **API Gateway (Kong)**: http://localhost:8000 (proxy) | http://localhost:8001 (admin)
- **Konga UI**: http://localhost:1337
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin:admin)
- **Kibana**: http://localhost:5601
- **Redis Commander**: http://localhost:8081
- **MongoDB**: mongodb://root:nexora_dev_password@localhost:27017
- **Consul**: http://localhost:8500
- **Mailhog**: http://localhost:8025 (email testing)

#### 2. Setup Project (Monorepo Workspaces)

```bash
# Install dependencies for all services and packages
npm install

# Build all packages and services
npm run build

# Start development servers for all services
npm run dev

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format
```

#### 3. Environment Variables

Create `.env` in root directory:

```env
# Node Environment
NODE_ENV=development
LOG_LEVEL=debug

# Services
API_GATEWAY_PORT=3005
AUTH_SERVICE_PORT=3001
REALTIME_SERVICE_PORT=3002

# Database
MONGODB_URI=mongodb://root:nexora_dev_password@localhost:27017/nexora?authSource=admin
MONGODB_DATABASE=nexora

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD="nexora_dev_password"

# JWT
JWT_SECRET=nexora_jwt_secret_development_key_change_in_production
JWT_EXPIRY_ACCESS=900
JWT_EXPIRY_REFRESH=604800

# Service Mesh
CONSUL_HOST=localhost
CONSUL_PORT=8500
SERVICE_MESH=consul

# AWS / Storage
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET=nexora-files

# Email
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@nexora.io

# OAuth (Google)
OAUTH_GOOGLE_CLIENT_ID=your_client_id
OAUTH_GOOGLE_CLIENT_SECRET=your_client_secret

# OAuth (Microsoft)
OAUTH_MICROSOFT_CLIENT_ID=your_client_id
OAUTH_MICROSOFT_CLIENT_SECRET=your_client_secret

# AI Services
CLAUDE_API_KEY=your_anthropic_key
OLLAMA_HOST=http://localhost:11434
```

### Architecture

#### Microservices Pattern

Nexora uses a **microservices architecture** with the following components:

1. **API Gateway** (Kong) - Request routing, authentication, rate limiting
2. **Service Mesh** (Consul) - Service discovery, health checking
3. **Distributed Data** - MongoDB (primary), Redis (cache/sessions), Elasticsearch (search)
4. **Message Queue** - BullMQ (job queue)
5. **Real-time** - Socket.IO (chat, presence)
6. **Monitoring** - Prometheus, Grafana, Sentry
7. **Logging** - ELK Stack (Elasticsearch, Logstash, Kibana)

#### Service Communication

- **Synchronous**: HTTP REST (via Kong gateway)
- **Asynchronous**: Redis Pub/Sub, BullMQ
- **Service Discovery**: Consul DNS
- **Circuit Breaker**: Kong plugin
- **Tracing**: OpenTelemetry (coming soon)

### Microservices Ports

Each service runs on its designated port and registers with Consul:

- **API Gateway**: 3005 (80/443 via Kong proxy)
- **Auth Service**: 3001
- **Realtime Service**: 3002
- **File Service**: 3004
- **HR Service**: 3010
- **Attendance Service**: 3011
- **Payroll Service**: 3012
- **Project Service**: 3020
- **Task Service**: 3021
- **Board Service**: 3022
- **CRM Service**: 3030
- **Invoice Service**: 3031
- **Expense Service**: 3032
- **Document Service**: 3040
- **Asset Service**: 3041
- **Recruitment Service**: 3050
- **Notification Service**: 3060
- **Analytics Service**: 3070
- **AI Service**: 3080
- **Integration Service**: 3090

### Development Workflow

#### Creating a New Microservice

```bash
# 1. Create service directory
mkdir services/new-service
cd services/new-service

# 2. Create package.json with service template
# (See services/api-gateway/package.json as reference)

# 3. Install dependencies
npm install

# 4. Create NestJS application structure
# src/
#   ├── main.ts
#   ├── app.module.ts
#   ├── app.service.ts
#   ├── app.controller.ts
#   └── modules/
#       └── feature/
#           ├── feature.module.ts
#           ├── feature.service.ts
#           └── feature.controller.ts

# 5. Register in root package.json workspaces
# 6. Add to docker-compose.yml if needed
# 7. Register service with Kong API Gateway
```

#### Database Migrations

```bash
# MongoDB migrations are applied automatically on service startup
# Schema versioning is supported for backward compatibility
# See infrastructure/mongo-init.js for initial schema setup
```

### Testing

```bash
# Unit tests
npm run test

# Integration tests (requires docker-compose up)
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:cov
```

### Deployment

#### Docker Push & Deploy

```bash
# Build Docker images
npm run docker:build

# Push to registry
docker push nexora/api-gateway:latest
docker push nexora/auth-service:latest
# ... push other services

# Deploy to Kubernetes
npm run k8s:deploy

# Check deployment status
kubectl get pods -n nexora
kubectl logs -n nexora -l app=api-gateway

# Delete all resources
npm run k8s:delete
```

#### Kubernetes Deployment

```bash
# Deploy namespaces and config
kubectl apply -f infrastructure/k8s/00-namespaces.yaml
kubectl apply -f infrastructure/k8s/01-config-secrets.yaml

# Deploy databases
kubectl apply -f infrastructure/k8s/02-database-services.yaml

# Deploy API Gateway
kubectl apply -f infrastructure/k8s/03-api-gateway.yaml

# Deploy individual services
kubectl apply -f infrastructure/k8s/services/

# Check status
kubectl get all -n nexora
```

### Monitoring

#### Metrics & Dashboards

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin:admin)
- **Kibana**: http://localhost:5601
- **Konga**: http://localhost:1337 (Kong Admin UI)

#### Logs

All services log to Elasticsearch via Logstash. View logs in Kibana.

```bash
# View docker logs
docker-compose logs -f [service-name]

# View kubernetes logs
kubectl logs -n nexora -l app=api-gateway --tail=100 -f
```

### Troubleshooting

#### Services not communicating

1. Check Consul service registration
2. Verify Kong routes are configured
3. Check Redis connectivity
4. Review logs in Kibana

#### MongoDB connection issues

```bash
# Connect to MongoDB
mongosh 'mongodb://root:nexora_dev_password@localhost:27017'

# Verify collections
use nexora
db.users.find().pretty()
```

#### Memory/CPU limits

Increase Docker resource limits in `docker-compose.yml`:

```yaml
services:
  elasticsearch:
    ...
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G
```

### API Documentation

Once API Gateway is running:

```
http://localhost:3005/api/docs  # Swagger/OpenAPI documentation
```

### Contributing

1. Create a feature branch from `main`
2. Make changes and run tests
3. Format code: `npm run format`
4. Lint: `npm run lint`
5. Submit PR with description

### Project Status

**Phase 1: Foundation (Current)**
- [x] Microservices architecture setup
- [x] Docker Compose for local development
- [x] Kubernetes manifests for production
- [x] API Gateway (Kong) configuration
- [x] Service discovery (Consul)
- [x] Database initialization
- [x] Monitoring stack (Prometheus, Grafana)
- [x] Logging stack (ELK)
- [ ] API Gateway implementation
- [ ] Auth Service implementation
- [ ] Core utilities and middleware

**Phase 2: Core Services (Next)**
- [ ] HR Service
- [ ] Attendance Service
- [ ] Leave Service
- [ ] Payroll Service

### Support

For issues, questions, or contributions:
- 📧 Email: support@nexora.io
- 🐛 Issues: [GitHub Issues](https://github.com/nugen-it/nexora/issues)
- 📚 Docs: [Nexora Documentation](https://docs.nexora.io)

### License

**CONFIDENTIAL** — Nugen IT Services

---

**Last Updated**: March 18, 2026
**Version**: 1.0.0 (Phase 1)
