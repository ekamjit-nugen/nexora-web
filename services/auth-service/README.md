# Auth Service Documentation

Nexora Auth Service is a comprehensive authentication microservice providing JWT-based authentication, OAuth 2.0 integration, SAML SSO, and MFA support.

## Features

- **Email/Password Authentication**: User registration and login with bcrypt password hashing
- **JWT Tokens**: Access tokens (15 minutes) and refresh tokens (7 days)
- **OAuth 2.0 Support**: Google and Microsoft OAuth integration
- **SAML SSO**: Enterprise SAML 2.0 single sign-on support
- **Multi-Factor Authentication**: TOTP (Time-based One-Time Password) with QR code generation
- **Account Lockout**: Automatic account lockout after 5 failed login attempts (30-minute lockout)
- **Email Verification**: Email verification flow with token expiry
- **Password Security**: Strong password requirements (min 8 chars, uppercase, lowercase, numbers, special chars)
- **Health Checks**: Kubernetes-ready health, readiness, and liveness endpoints

## Project Structure

```
services/auth-service/
├── src/
│   ├── main.ts                          # Bootstrap file
│   ├── app.module.ts                    # Root module
│   ├── auth/
│   │   ├── auth.service.ts              # Business logic
│   │   ├── auth.controller.ts           # HTTP endpoints
│   │   ├── auth.service.spec.ts         # Service unit tests (18 test cases)
│   │   ├── auth.controller.spec.ts      # Controller tests (9 test cases)
│   │   ├── schemas/
│   │   │   └── user.schema.ts           # MongoDB User schema with 40+ indexes
│   │   ├── dto/
│   │   │   └── index.ts                 # Data transfer objects
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts          # JWT Passport strategy
│   │   │   ├── google.strategy.ts       # Google OAuth strategy
│   │   │   ├── microsoft.strategy.ts    # Microsoft OAuth strategy
│   │   │   └── saml.strategy.ts         # SAML strategy
│   │   └── guards/
│   │       └── jwt-auth.guard.ts        # JWT authentication guard
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts         # Health check endpoints
├── package.json                         # Dependencies (45+ packages)
├── jest.config.js                       # Jest testing configuration
├── tsconfig.json                        # TypeScript configuration
├── .env.local                           # Environment variables template
└── README.md                            # This file
```

## API Endpoints

### Authentication Endpoints

**POST /api/v1/auth/register**
- Register new user account
- Body: `{ email, password, firstName, lastName }`
- Response: User object

**POST /api/v1/auth/login**
- Login with email and password
- Body: `{ email, password, rememberMe }`
- Response: `{ accessToken, refreshToken, expiresIn }`

**POST /api/v1/auth/refresh**
- Refresh expired access token
- Body: `{ refreshToken }`
- Response: `{ accessToken, refreshToken, expiresIn }`

**POST /api/v1/auth/logout**
- Logout user (requires JWT)
- Headers: `Authorization: Bearer <token>`
- Response: Success message

### User Endpoints

**GET /api/v1/auth/me**
- Get current user profile (requires JWT)
- Headers: `Authorization: Bearer <token>`
- Response: User object

### OAuth Endpoints

**GET /api/v1/auth/oauth/google**
- Redirect to Google login

**GET /api/v1/auth/oauth/google/callback**
- Google OAuth callback handler

**GET /api/v1/auth/oauth/microsoft**
- Redirect to Microsoft login

**GET /api/v1/auth/oauth/microsoft/callback**
- Microsoft OAuth callback handler

**GET /api/v1/auth/saml/login**
- SAML SSO login redirect

**POST /api/v1/auth/saml/callback**
- SAML SSO callback handler

### MFA Endpoints

**POST /api/v1/auth/mfa/setup**
- Setup TOTP MFA (requires JWT)
- Response: `{ secret, qrCode }`

**POST /api/v1/auth/mfa/verify**
- Verify TOTP code and enable MFA (requires JWT)
- Body: `{ code, rememberThisDevice }`
- Response: Success message

### Health Endpoints

**GET /api/v1/health**
- Service health check
- Response: `{ status: 'healthy', service: 'auth-service', uptime }`

**GET /api/v1/health/ready**
- Kubernetes readiness probe

**GET /api/v1/health/live**
- Kubernetes liveness probe

## Environment Variables

```env
# Service Configuration
AUTH_SERVICE_PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://admin:password@localhost:27017/nexora_auth
REDIS_URI=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# OAuth Providers
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx

# SAML
SAML_ENTRY_POINT=https://provider.com/sso
SAML_ISSUER=nexora
```

## Running the Service

### Development

```bash
# Install dependencies
npm install

# Start service with hot reload
npm run dev

# Run tests
npm run test

# Run tests with coverage
npm run test:cov
```

### Production

```bash
# Build
npm run build

# Start
npm start
```

### Docker

```bash
# Build Docker image
docker build -t nexora/auth-service:latest .

# Run container
docker run -p 3001:3001 --env-file .env.local nexora/auth-service:latest
```

## Testing

Comprehensive test suite with 27+ test cases following Testmo format:

- **Unit Tests**: Service layer (18 test cases)
  - User registration (validation, duplicates, weak passwords)
  - Login (valid/invalid credentials, account lockout)
  - Token refresh and validation
  - MFA setup and verification
  - User retrieval

- **Integration Tests**: Controller layer (9 test cases)
  - Endpoint response formats
  - OAuth callbacks
  - MFA flow
  - Logout functionality

Run tests:
```bash
npm run test                  # Run all tests
npm run test:watch          # Watch mode
npm run test:cov            # With coverage report
npm run test:debug          # With debugging
```

## Security Features

- **Password Hashing**: bcrypt with salt rounds = 10
- **JWT Signing**: HS256 algorithm with configurable secret
- **Account Lockout**: Automatic lockout after failed attempts
- **CORS Protection**: Configurable origin whitelist
- **Helmet Security Headers**: XSS, CSRF, and other protections
- **Rate Limiting**: Built-in request rate limiting (can be extended)
- **Email Verification**: Token-based email verification flow
- **Phone Verification**: Optional phone verification for MFA

## Error Handling

The service returns standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "statusCode": 400,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

Common HTTP Status Codes:
- `200 OK` - Successful request
- `201 Created` - User created successfully
- `400 Bad Request` - Invalid input or validation error
- `401 Unauthorized` - Invalid credentials or expired token
- `403 Forbidden` - Account locked or inactive
- `404 Not Found` - User not found
- `409 Conflict` - User already exists
- `500 Internal Server Error` - Unexpected error

## Database Schema

### User Collection

```javascript
{
  _id: ObjectId,
  email: String (unique, indexed),
  password: String (hashed),
  firstName: String,
  lastName: String,
  avatar: String,
  isEmailVerified: Boolean,
  isPhoneVerified: Boolean,
  mfaEnabled: Boolean,
  mfaMethod: String (TOTP|SMS|EMAIL),
  mfaSecret: String,
  mfaBackupCodes: [String],
  lastLogin: Date,
  lastLoginIp: String,
  loginAttempts: Number,
  lockUntil: Date,
  isActive: Boolean,
  roles: [String],
  permissions: [String],
  oauthProviders: {
    google: { id, email },
    microsoft: { id, email },
    saml: { id, email }
  },
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date (for soft delete)
}
```

## Deployment

### Docker Compose
```bash
cd ../.. && docker-compose up auth-service
```

### Kubernetes
```bash
kubectl apply -f infrastructure/k8s/03-auth-service.yaml
```

### Azure (App Service / Container Apps)
```bash
azd deploy
```

## Troubleshooting

### Port Already in Use
```bash
lsof -i :3001  # Check what's using port
kill -9 <PID>  # Kill process
```

### Database Connection Failed
```bash
# Verify connection string in .env.local
# Check MongoDB is running: docker-compose ps mongodb
```

### JWT Token Expired
- Access token expires in 15 minutes
- Use refresh token to get new access token
- Refresh token expires in 7 days

## Performance Metrics

- **Authentication Response Time**: < 200ms
- **Token Generation**: < 50ms
- **Database Query**: < 100ms
- **OAuth Integration**: < 1s (depends on OAuth provider)
- **Concurrent Users**: Support 1000+ concurrent connections

## Roadmap

- [ ] Biometric authentication (fingerprint, face recognition)
- [ ] Passwordless authentication (WebAuthn)
- [ ] SMS-based MFA
- [ ] Email-based MFA with OTP
- [ ] Session management and device tracking
- [ ] Login audit logs
- [ ] Compliance certifications (SOC 2, ISO 27001)

## Support & Contributing

For issues, questions, or contributions:
- GitHub Issues: https://github.com/nexora/nexora/issues
- Slack: #auth-service channel
- Email: support@nexora.dev

## License

MIT License - See LICENSE file for details

---

**Last Updated**: January 2024
**Version**: 1.0.0
**Maintainer**: Nexora Team

/*
 * When: Developer reads this documentation
 * if: they need to understand auth service architecture and APIs
 * then: this README provides comprehensive guidance for integration and deployment
 */
