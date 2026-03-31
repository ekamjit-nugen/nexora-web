# Wave 4: Quick Start Guide (5-Minute Overview)

## What's Included

Wave 4 adds 4 core features:

1. **Reporting** - CFD diagrams, cycle time analysis, epic progress
2. **Time Tracking** - Log time with billable costs, weekly timesheets
3. **Client Feedback** - Direct feedback channel with task linking
4. **Asset Preview** - Manage project assets with metadata

## Files Changed/Added

```
services/project-service/
├── package.json (added mongodb-memory-server)
├── src/project/
│   ├── schemas/
│   │   ├── time-log.schema.ts ✨
│   │   ├── client-feedback.schema.ts ✨
│   │   └── asset-preview.schema.ts ✨
│   ├── services/
│   │   ├── reporting.service.ts ✨
│   │   ├── time-tracking.service.ts ✨
│   │   ├── client-feedback.service.ts ✨
│   │   └── asset-preview.service.ts ✨
│   ├── controllers/
│   │   ├── wave4.controller.ts ✨
│   │   └── asset-preview.controller.ts ✨
│   ├── dto/
│   │   └── wave4.dto.ts ✨
│   ├── project.module.ts (updated)
│   └── __tests__/
│       └── wave4.test.ts ✨
```

## Quick API Examples

### Time Tracking

```bash
# Log time
POST /projects/:projectId/time-logs
{
  "taskId": "task-123",
  "duration": 90,          # minutes
  "description": "Implementation",
  "date": "2026-03-31",
  "billable": true,
  "rate": 100              # $/hour
}

# Get weekly timesheet
GET /projects/:projectId/timesheets/:userId?weekStart=2026-03-31

# Submit timesheet (lock for approval)
POST /projects/:projectId/timesheets/:userId/submit

# Approve timesheet
POST /projects/:projectId/timesheets/:userId/approve

# Reject timesheet
POST /projects/:projectId/timesheets/:userId/reject
```

### Client Feedback

```bash
# Submit feedback
POST /projects/:projectId/feedback
{
  "clientId": "client-123",
  "clientName": "John Doe",
  "clientEmail": "john@example.com",
  "type": "bug",
  "title": "Login broken",
  "description": "Can't log in",
  "priority": 2,
  "attachments": ["screenshot.png"]
}

# Update status
PUT /projects/:projectId/feedback/:feedbackId/status
{ "status": "in_progress" }

# Link to internal task
PUT /projects/:projectId/feedback/:feedbackId/link-task
{ "taskKey": "PROJ-123" }

# Get stats
GET /projects/:projectId/feedback/stats
```

### Reports

```bash
# Cumulative flow diagram (daily snapshots)
GET /projects/:projectId/reports/cumulative-flow?from=2026-03-01&to=2026-03-31

# Cycle time analysis
GET /projects/:projectId/reports/cycle-time

# Epic progress
GET /projects/:projectId/reports/epic-progress

# Billing export
GET /projects/:projectId/reports/billing/export?from=2026-03-01&to=2026-03-31
```

### Asset Preview

```bash
# Upload asset
POST /projects/:projectId/assets
{
  "taskId": "task-456",
  "url": "https://cdn.example.com/design.figma",
  "name": "Design System",
  "type": "figma",
  "size": 2400000,
  "width": 1920,
  "height": 1080
}

# Get all project assets
GET /projects/:projectId/assets

# Get task assets
GET /projects/:projectId/assets/task/:taskId

# Get recent assets
GET /projects/:projectId/assets/recent?limit=10

# Asset stats
GET /projects/:projectId/assets/stats
```

## Setup

```bash
# Install dependencies (includes mongodb-memory-server)
npm install

# Run tests (validates everything works)
npm test

# Run in watch mode
npm test:watch
```

## Key Metrics

| Metric | Value |
|--------|-------|
| Test Coverage | 40+ test cases |
| Services | 4 specialized services |
| Endpoints | 30+ REST endpoints |
| Schemas | 3 new collections |
| DTOs | 20+ validator classes |
| Code | 1500+ lines |

## Module Registration

All Wave 4 components are registered in `project.module.ts`:

```typescript
// Schemas
MongooseModule.forFeature([
  { name: 'TimeLog', schema: TimeLogSchema },
  { name: 'ClientFeedback', schema: ClientFeedbackSchema },
  { name: 'AssetPreview', schema: AssetPreviewSchema },
])

// Controllers
[ReportingController, TimeTrackingController, TimesheetController, 
 BillingController, ClientFeedbackController, AssetPreviewController]

// Services
[ReportingService, TimeTrackingService, ClientFeedbackService, AssetPreviewService]
```

## Common Tasks

### Log Time for a Task

```typescript
// POST /projects/proj-123/time-logs
await timeTrackingService.logTime(
  'proj-123',           // projectId
  'task-456',           // taskId
  'user-789',           // userId
  {
    duration: 90,
    description: 'Implemented form validation',
    date: '2026-03-31',
    billable: true,
    rate: 100
  }
);
```

### Get Weekly Timesheet

```typescript
// GET /projects/proj-123/timesheets/user-789?weekStart=2026-03-31
const timesheet = await timeTrackingService.getWeeklyTimesheet(
  'proj-123',
  'user-789',
  '2026-03-31'
);

console.log(timesheet.weekTotal.billableHours); // 40
console.log(timesheet.weekTotal.billableCost);  // 4000
```

### Submit Feedback

```typescript
// POST /projects/proj-123/feedback
const feedback = await clientFeedbackService.submitFeedback(
  'proj-123',
  {
    clientId: 'client-123',
    clientName: 'John Doe',
    clientEmail: 'john@example.com',
    type: 'bug',
    title: 'Login broken',
    description: 'Cannot log in with Google OAuth',
    priority: 1,
    attachments: ['screenshot.png']
  }
);
```

### Get Cycle Time Stats

```typescript
// GET /projects/proj-123/reports/cycle-time
const stats = await reportingService.getCycleTimeData('proj-123');

console.log(stats.avgCycleTime);     // 3.2 days
console.log(stats.medianCycleTime);  // 2.8 days
console.log(stats.p90CycleTime);     // 7.1 days
```

## Testing

```bash
# All tests
npm test

# Specific test suite
npm test -- wave4.test.ts

# With coverage
npm run test:cov

# Watch mode
npm run test:watch
```

All 40+ tests should pass. If any fail, check MongoDB connection and ensure mongodb-memory-server is installed.

## Next Steps

1. **Frontend** - Build UI components for Wave 4 features
2. **Integration** - Test full request/response cycles
3. **UAT** - User acceptance testing
4. **Deployment** - Deploy to production

## Troubleshooting

**Tests failing?**
- Ensure mongodb-memory-server is installed: `npm install --save-dev mongodb-memory-server`
- Clear node_modules: `rm -rf node_modules && npm install`

**Service not found?**
- Verify project.module.ts has all Wave 4 imports

**API returning 404?**
- Check controller routing matches expected paths
- Verify projectId parameter is passed

## Documentation

- [WAVE-4-COMPLETION.md](./WAVE-4-COMPLETION.md) - Full implementation guide
- [WAVE-4-API-REFERENCE.md](./WAVE-4-API-REFERENCE.md) - Endpoint details
- Test file: `src/project/__tests__/wave4.test.ts` - Usage examples

**Ready to integrate!** 🚀
