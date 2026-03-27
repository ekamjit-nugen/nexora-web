import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { createProxyMiddleware } from 'http-proxy-middleware';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

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
};

// Route map: path prefix -> service URL
const ROUTES: Array<{ paths: string[]; target: string; name: string }> = [
  { paths: ['/api/v1/platform'], target: SERVICES.auth, name: 'auth-service' },
  { paths: ['/api/v1/auth'], target: SERVICES.auth, name: 'auth-service' },
  { paths: ['/api/v1/employees', '/api/v1/departments', '/api/v1/designations', '/api/v1/teams', '/api/v1/clients', '/api/v1/invoices'], target: SERVICES.hr, name: 'hr-service' },
  { paths: ['/api/v1/attendance', '/api/v1/shifts', '/api/v1/alerts'], target: SERVICES.attendance, name: 'attendance-service' },
  { paths: ['/api/v1/policies'], target: SERVICES.policy, name: 'policy-service' },
  { paths: ['/api/v1/leaves', '/api/v1/leave-policies'], target: SERVICES.leave, name: 'leave-service' },
  { paths: ['/api/v1/projects'], target: SERVICES.project, name: 'project-service' },
  { paths: ['/api/v1/tasks', '/api/v1/boards', '/api/v1/sprints', '/api/v1/timesheets'], target: SERVICES.task, name: 'task-service' },
  { paths: ['/api/v1/calls', '/api/v1/meetings'], target: SERVICES.calling, name: 'calling-service' },
  { paths: ['/api/v1/ai'], target: SERVICES.ai, name: 'ai-service' },
  { paths: ['/api/v1/chat'], target: SERVICES.chat, name: 'chat-service' },
];

// Middleware
app.use(helmet());
app.use(compression({
  filter: (req: any) => {
    // Don't compress SSE/streaming responses
    if (req.url?.includes('/stream') || req.headers.accept === 'text/event-stream') {
      return false;
    }
    return compression.filter(req, req.res);
  },
}));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Organization-Id');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Extract organizationId from JWT and forward as header to downstream services
app.use((req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.decode(token) as any;
      if (decoded?.organizationId) {
        req.headers['x-organization-id'] = decoded.organizationId;
      }
    } catch {
      // Ignore decode errors — downstream service handles auth validation
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
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
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
