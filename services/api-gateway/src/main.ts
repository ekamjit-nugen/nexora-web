import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { createProxyMiddleware } from 'http-proxy-middleware';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
// @ts-ignore
import rateLimit from 'express-rate-limit';

const app = express();
const port = process.env.GATEWAY_PORT || 3005;

// Service URLs
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  hr: process.env.HR_SERVICE_URL || 'http://hr-service:3010',
  attendance: process.env.ATTENDANCE_SERVICE_URL || 'http://attendance-service:3011',
  leave: process.env.LEAVE_SERVICE_URL || 'http://leave-service:3012',
  project: process.env.PROJECT_SERVICE_URL || 'http://project-service:3020',
  task: process.env.TASK_SERVICE_URL || 'http://task-service:3021',
  ai: process.env.AI_SERVICE_URL || 'http://ai-service:3080',
  chat: process.env.CHAT_SERVICE_URL || 'http://chat-service:3002',
  calling: process.env.CALLING_SERVICE_URL || 'http://calling-service:3051',
  policy: process.env.POLICY_SERVICE_URL || 'http://policy-service:3013',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3053',
  media: process.env.MEDIA_SERVICE_URL || 'http://media-service:3052',
  payroll: process.env.PAYROLL_SERVICE_URL || 'http://payroll-service:3014',
  bench: process.env.BENCH_SERVICE_URL || 'http://bench-service:3030',
  asset: process.env.ASSET_SERVICE_URL || 'http://asset-service:3031',
  knowledge: process.env.KNOWLEDGE_SERVICE_URL || 'http://knowledge-service:3032',
  helpdesk: process.env.HELPDESK_SERVICE_URL || 'http://helpdesk-service:3033',
};

// Route map: path prefix -> service URL
const ROUTES: Array<{ paths: string[]; target: string; name: string }> = [
  { paths: ['/api/v1/platform'], target: SERVICES.auth, name: 'auth-service' },
  { paths: ['/api/v1/auth'], target: SERVICES.auth, name: 'auth-service' },
  { paths: ['/api/v1/settings'], target: SERVICES.auth, name: 'auth-service' },
  { paths: ['/api/v1/employees', '/api/v1/departments', '/api/v1/designations', '/api/v1/teams', '/api/v1/clients', '/api/v1/invoices', '/api/v1/billing', '/api/v1/call-logs'], target: SERVICES.hr, name: 'hr-service' },
  { paths: ['/api/v1/attendance', '/api/v1/shifts', '/api/v1/alerts'], target: SERVICES.attendance, name: 'attendance-service' },
  { paths: ['/api/v1/policies'], target: SERVICES.policy, name: 'policy-service' },
  { paths: ['/api/v1/leaves', '/api/v1/leave-policies'], target: SERVICES.leave, name: 'leave-service' },
  { paths: ['/api/v1/projects'], target: SERVICES.project, name: 'project-service' },
  { paths: ['/api/v1/tasks', '/api/v1/boards', '/api/v1/sprints', '/api/v1/timesheets', '/api/v1/standups'], target: SERVICES.task, name: 'task-service' },
  { paths: ['/api/v1/calls', '/api/v1/meetings'], target: SERVICES.calling, name: 'calling-service' },
  { paths: [
    '/api/v1/salary-structures', '/api/v1/payroll-runs', '/api/v1/payslips',
    '/api/v1/investment-declarations', '/api/v1/expense-claims', '/api/v1/onboarding',
    '/api/v1/offboarding', '/api/v1/analytics', '/api/v1/loans', '/api/v1/jobs',
    '/api/v1/candidates', '/api/v1/recruitment', '/api/v1/statutory-reports',
    '/api/v1/goals', '/api/v1/goals-tree', '/api/v1/review-cycles', '/api/v1/reviews',
    '/api/v1/announcements', '/api/v1/kudos', '/api/v1/surveys',
    '/api/v1/courses', '/api/v1/enrollments', '/api/v1/certificates',
    '/api/v1/learning-paths', '/api/v1/bank-transactions',
  ], target: SERVICES.payroll, name: 'payroll-service' },
  { paths: ['/api/v1/ai'], target: SERVICES.ai, name: 'ai-service' },
  { paths: ['/api/v1/chat'], target: SERVICES.chat, name: 'chat-service' },
  { paths: ['/api/v1/notifications'], target: SERVICES.notification, name: 'notification-service' },
  { paths: ['/api/v1/media'], target: SERVICES.media, name: 'media-service' },
  { paths: ['/api/v1/bench'], target: SERVICES.bench, name: 'bench-service' },
  { paths: ['/api/v1/assets'], target: SERVICES.asset, name: 'asset-service' },
  { paths: ['/api/v1/knowledge'], target: SERVICES.knowledge, name: 'knowledge-service' },
  { paths: ['/api/v1/helpdesk'], target: SERVICES.helpdesk, name: 'helpdesk-service' },
];

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP — API gateway proxies to multiple services on different ports
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' as const },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(compression({
  filter: (req: any) => {
    // Don't compress SSE/streaming responses
    if (req.url?.includes('/stream') || req.headers.accept === 'text/event-stream') {
      return false;
    }
    return compression.filter(req, req.res);
  },
}) as any);
// CORS — restrict to allowed origins
// Uses writeHead override to ensure CORS headers survive proxy responses
// GW-008: Warn if CORS_ORIGINS is not explicitly set in production
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
  console.warn('WARNING: CORS_ORIGINS not set in production — defaulting to localhost origins. This should be configured for production deployments.');
}
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3100,http://localhost:3005')
  .split(',').map(o => o.trim());
app.use((req: any, res: any, next: any) => {
  const origin = req.headers.origin;
  const allowedOrigin = (!origin || ALLOWED_ORIGINS.includes(origin))
    ? (origin || ALLOWED_ORIGINS[0])
    : null;

  // Handle preflight immediately
  if (req.method === 'OPTIONS') {
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    // GW-002: Removed X-Internal-Service-Key — internal keys must never be sent from browsers
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Organization-Id, X-XSRF-TOKEN, X-Nexora-Signature, X-Nexora-Event');
    return res.sendStatus(204);
  }

  // Override writeHead to inject CORS headers AFTER proxy sets its headers
  const originalWriteHead = res.writeHead.bind(res);
  res.writeHead = function (statusCode: number, ...args: any[]) {
    // Remove any downstream CORS headers
    res.removeHeader('access-control-allow-origin');
    res.removeHeader('access-control-allow-credentials');
    res.removeHeader('access-control-allow-methods');
    res.removeHeader('access-control-allow-headers');

    // Set gateway CORS headers
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return originalWriteHead(statusCode, ...args);
  };

  next();
});

// Rate limiting
// GW-003: Increased from 100 to 300 req/min — 100 was too aggressive for dashboard-heavy SPAs
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // default 15 min
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10), // configurable, default 20
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter as any);
app.use('/api/v1/auth/login', authLimiter as any);
app.use('/api/v1/auth/send-otp', authLimiter as any);
app.use('/api/v1/auth/verify-otp', authLimiter as any);
app.use('/api/v1/auth/register', authLimiter as any);

// Extract organizationId from JWT and forward as header to downstream services
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set — skipping JWT verification middleware. x-organization-id header will not be forwarded.');
}
app.use((req, _res, next) => {
  if (!JWT_SECRET) return next();
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded?.organizationId) {
        req.headers['x-organization-id'] = decoded.organizationId;
      }
    } catch {
      // Verification failed — do NOT set x-organization-id; downstream service handles auth
    }
  }
  next();
});

// Health check — aggregated
app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = {};

  await Promise.all(
    Object.entries(SERVICES).map(async ([name, url]) => {
      try {
        await axios.get(`${url}/api/v1/health`, { timeout: 3000 });
        checks[`${name}-service`] = 'healthy';
      } catch {
        checks[`${name}-service`] = 'unhealthy';
      }
    }),
  );

  const allHealthy = Object.values(checks).every((s) => s === 'healthy');
  res.json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
    uptime: process.uptime(),
    services: checks,
  });
});

// SSE/Stream endpoint - bypass proxy, pipe directly
app.post('/api/v1/ai/chat/stream', express.json({ limit: '5mb' }), async (req: any, res: any) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    const streamOrigin = req.headers.origin;
    if (streamOrigin && ALLOWED_ORIGINS.includes(streamOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', streamOrigin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.flushHeaders();

    const upstream = await axios.post(
      `${SERVICES.ai}/api/v1/ai/chat/stream`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
        },
        responseType: 'stream',
        timeout: 120000,
      },
    );

    upstream.data.on('data', (chunk: Buffer) => { res.write(chunk); });
    upstream.data.on('end', () => { res.end(); });
    upstream.data.on('error', () => { res.end(); });
  } catch {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'AI service unavailable' }));
  }
});

// Attendance-specific policies — must be registered BEFORE the generic /api/v1/policies route
// (attendance-service exposes policies at /api/v1/policies internally; the gateway /api/v1/policies
// routes to policy-service, so we intercept /api/v1/attendance/policies first and rewrite the path)
app.use('/api/v1/attendance/policies', createProxyMiddleware({
  target: SERVICES.attendance,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/attendance/policies': '/api/v1/policies' },
}));

// GW-005: WebSocket connections (Socket.IO for chat, calling, presence) bypass this HTTP
// gateway and connect directly to the respective services (chat-service:3002, calling-service:3051).
// This is intentional — the gateway only proxies REST/HTTP traffic. WebSocket auth is handled
// by each service's own socket middleware using JWT verification.

// Register proxy routes
for (const route of ROUTES) {
  for (const path of route.paths) {
    app.use(
      path,
      createProxyMiddleware({
        target: route.target,
        changeOrigin: true,
        pathRewrite: (_path: string, req: any) => req.originalUrl,
      }),
    );
  }
}

app.listen(port, () => {
  console.log(`API Gateway running on http://localhost:${port}`);
  console.log('Routes:');
  for (const route of ROUTES) {
    console.log(`  ${route.paths.join(', ')} -> ${route.target} [${route.name}]`);
  }
});
