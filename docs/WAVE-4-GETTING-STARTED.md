# Wave 4: Getting Started for Developers

**For:** Frontend developers, QA engineers, and system integrators  
**Duration:** 15 minutes  
**Prerequisites:** Node.js 20+, basic knowledge of NestJS/TypeScript

---

## TL;DR - Start Here

**Wave 4 adds 4 capabilities to the Nexora platform:**

1. **Reporting** - Project insights (CFD, cycle time, velocity)
2. **Time Tracking** - Log time, weekly timesheets, billing
3. **Client Feedback** - Public feedback portal with status workflow
4. **Asset Preview** - Manage project assets (images, videos, documents)

**All backend is done.** You need to:
1. Build frontend UI components
2. Call the REST endpoints
3. Handle responses and errors

---

## Setup (5 minutes)

### 1. Install Dependencies

```bash
cd services/project-service
npm install  # installs mongodb-memory-server for tests
```

### 2. Run Tests (to verify setup works)

```bash
npm test     # should see 40+ tests passing ✅
```

### 3. Start the Service

```bash
npm run dev  # starts on port 3000 (usually)
```

---

## Quick Feature Overview

### Feature 1: Reporting 📊

**What it does:** Provides project analytics

```
CFD Diagram      → Daily task distribution across workflow
Cycle Time       → How fast tasks complete (avg/median/p90)
Epic Progress    → Story completion per epic
Velocity Report  → Sprint completion trends
Billing Report   → Project costs by user/task
```

**REST Endpoints:**
```
GET /projects/:projectId/reports/cumulative-flow?from=2026-03-01&to=2026-03-31
GET /projects/:projectId/reports/cycle-time
GET /projects/:projectId/reports/epic-progress
GET /projects/:projectId/reports/velocity/export
GET /projects/:projectId/reports/billing/export?from=2026-03-01&to=2026-03-31
```

**Frontend Needs:**
- Chart component (Chart.js, Recharts, etc.) for CFD
- Metrics display (numbers and trends)
- Date range pickers for exports

---

### Feature 2: Time Tracking ⏱️

**What it does:** Track time spent on tasks and manage timesheets

**Core Workflow:**
```
1. Developer logs time (duration, description, date, billable flag)
2. Weekly timesheet aggregates daily entries
3. Manager approves/rejects timesheet
4. Billing calculates costs (hours × hourly rate)
```

**REST Endpoints:**
```
POST   /projects/:projectId/time-logs
GET    /projects/:projectId/time-logs/task/:taskId
GET    /projects/:projectId/time-logs/user/:userId
PUT    /projects/:projectId/time-logs/:logId
DELETE /projects/:projectId/time-logs/:logId

GET    /projects/:projectId/timesheets/:userId?weekStart=2026-03-31
POST   /projects/:projectId/timesheets/:userId/submit
POST   /projects/:projectId/timesheets/:userId/approve
POST   /projects/:projectId/timesheets/:userId/reject

GET    /projects/:projectId/billing/user/:userId
GET    /projects/:projectId/billing/project
```

**Frontend Needs:**
- Time entry quick-form (duration in minutes, description, billable toggle)
- Weekly timesheet view (table format with daily breakdown)
- Manager approval interface
- Time log history/edit view

**Example Request:**
```javascript
// Log time
POST /projects/proj-123/time-logs
{
  "taskId": "task-456",
  "duration": 90,         // minutes
  "description": "Implemented login form",
  "date": "2026-03-31",
  "billable": true,
  "rate": 100             // $/hour
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Time logged successfully",
  "data": {
    "_id": "log-123",
    "duration": 90,
    "billableCost": 150,    // (90/60) * 100
    "createdAt": "2026-03-31T14:30:00Z"
  }
}
```

---

### Feature 3: Client Feedback 💬

**What it does:** Public feedback channel for clients

**Feedback Lifecycle:**
```
new → reviewed → in_progress → completed → closed
```

**Feedback Types:**
- Bug report
- Feature request
- Question
- General feedback

**REST Endpoints:**
```
POST   /projects/:projectId/feedback
GET    /projects/:projectId/feedback?type=bug&status=new
GET    /projects/:projectId/feedback/:feedbackId
PUT    /projects/:projectId/feedback/:feedbackId/status
PUT    /projects/:projectId/feedback/:feedbackId/link-task
DELETE /projects/:projectId/feedback/:feedbackId
GET    /projects/:projectId/feedback/client/:clientId
GET    /projects/:projectId/feedback/stats
```

**Frontend Needs:**
- Public feedback submission form (no auth required)
- Feedback list with filters (type, status, priority)
- Status update UI for team members
- Analytics dashboard (counts by type/status)

**Example Request:**
```javascript
// Submit feedback
POST /projects/proj-123/feedback
{
  "clientId": "client-123",
  "clientName": "John Doe",
  "clientEmail": "john@example.com",
  "type": "bug",
  "title": "Login button broken",
  "description": "Cannot click the login button on mobile",
  "priority": 2,
  "attachments": ["https://cdn.example.com/screenshot.png"]
}
```

---

### Feature 4: Asset Preview 🖼️

**What it does:** Manage project assets (designs, videos, documents)

**Asset Types:**
- Image (PNG, JPG, WebP)
- Video (MP4, WebM)
- Figma design file
- Document (PDF, Word)
- Other

**REST Endpoints:**
```
POST   /projects/:projectId/assets
GET    /projects/:projectId/assets
GET    /projects/:projectId/assets/:assetId
GET    /projects/:projectId/assets/task/:taskId?type=image
PUT    /projects/:projectId/assets/:assetId
DELETE /projects/:projectId/assets/:assetId
DELETE /projects/:projectId/assets/task/:taskId
GET    /projects/:projectId/assets/stats
GET    /projects/:projectId/assets/recent?limit=10
```

**Frontend Needs:**
- Asset upload widget
- Gallery view (grid/list)
- Asset preview/lightbox
- Metadata editor (name, width, height, etc)

**Example Request:**
```javascript
// Upload asset
POST /projects/proj-123/assets
{
  "taskId": "task-456",
  "url": "https://cdn.example.com/design.figma",
  "name": "Design System v2",
  "type": "figma",
  "size": 2400000,
  "width": 1920,
  "height": 1080,
  "format": "figma"
}
```

---

## Developer Workflow

### Step 1: Understand the Data Model

Each feature uses a MongoDB collection:

```
TimeLog (time-log.schema.ts)
├── projectId, taskId, userId
├── duration (minutes), date
├── billable (boolean), rate ($/hour)
└── indexes for fast queries

ClientFeedback (client-feedback.schema.ts)
├── projectId, clientId
├── type, title, description, priority
├── status (workflow state)
└── taskKey (optional link to internal task)

AssetPreview (asset-preview.schema.ts)
├── projectId, taskId, uploadedBy
├── url, name, type, size
├── thumbnailUrl, width, height, format
└── metadata (custom JSON)
```

### Step 2: Review the Services

Each service handles business logic:

```
ReportingService
├── getCumulativeFlowData()
├── getCycleTimeData()
├── getEpicProgressData()
├── getVelocityReportForExport()
└── getBillingReportForExport()

TimeTrackingService
├── logTime()
├── getWeeklyTimesheet()
├── submitTimesheet()
├── approveTimesheet()
└── rejectTimesheet()

ClientFeedbackService
├── submitFeedback()
├── getFeedback()
├── updateFeedbackStatus()
├── linkFeedbackToTask()
└── getFeedbackStats()

AssetPreviewService
├── uploadAsset()
├── getTaskAssets()
├── getAsset()
└── getProjectAssets()
```

### Step 3: Call the APIs

All endpoints are REST and documented. Example:

```javascript
// Frontend code example (React)
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  }
});

// Log time
async function logTime(projectId, taskId, duration, description) {
  const response = await api.post(
    `/projects/${projectId}/time-logs`,
    {
      taskId,
      duration,
      description,
      date: new Date().toISOString().split('T')[0],
      billable: true,
      rate: 100
    }
  );
  return response.data;
}

// Get weekly timesheet
async function getWeeklyTimesheet(projectId, userId) {
  const weekStart = new Date().toISOString().split('T')[0];
  const response = await api.get(
    `/projects/${projectId}/timesheets/${userId}?weekStart=${weekStart}`
  );
  return response.data;
}

// Submit feedback
async function submitFeedback(projectId, feedback) {
  const response = await api.post(
    `/projects/${projectId}/feedback`,
    feedback
  );
  return response.data;
}
```

### Step 4: Build UI Components

For each feature:

1. **Time Tracking:**
   - Quick log form (Modal or inline)
   - Weekly timesheet (Table)
   - Approval interface (Manager view)

2. **Reporting:**
   - CFD chart (Line chart)
   - Cycle time metrics (Number display)
   - Epic progress bars (Progress bar)

3. **Client Feedback:**
   - Feedback form (Public, no auth)
   - Feedback list (Table with filters)
   - Status workflow UI

4. **Asset Preview:**
   - Upload widget (Drag-drop)
   - Gallery (Grid view)
   - Lightbox (Preview modal)

---

## Common Integration Patterns

### Pattern 1: Loading Data with Error Handling

```javascript
async function loadTimesheet(projectId, userId) {
  try {
    const data = await api.get(
      `/projects/${projectId}/timesheets/${userId}`
    );
    setTimesheet(data.data);
  } catch (error) {
    if (error.response?.status === 404) {
      toast.error('Timesheet not found');
    } else {
      toast.error('Failed to load timesheet');
    }
  }
}
```

### Pattern 2: Form Submission

```javascript
async function handleFeedbackSubmit(formData) {
  setLoading(true);
  try {
    await api.post(`/projects/${projectId}/feedback`, {
      clientId: formData.clientId,
      clientName: formData.clientName,
      clientEmail: formData.clientEmail,
      type: formData.type,
      title: formData.title,
      description: formData.description,
      priority: formData.priority,
      attachments: formData.attachments
    });
    toast.success('Feedback submitted');
    resetForm();
  } catch (error) {
    toast.error(error.response?.data?.message || 'Submission failed');
  } finally {
    setLoading(false);
  }
}
```

### Pattern 3: Real-time Updates

```javascript
useEffect(() => {
  loadAssets();
  // Refresh assets every 30 seconds
  const interval = setInterval(loadAssets, 30000);
  return () => clearInterval(interval);
}, [projectId]);
```

---

## Testing Your Integration

### Manual Testing

```bash
# 1. Start the backend
npm run dev

# 2. Test an endpoint with curl
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/projects/test-proj/reports/cycle-time

# 3. Should see JSON response with cycle time data
```

### Automated Testing

```javascript
// Example Jest test
test('logs time successfully', async () => {
  const response = await api.post('/projects/proj-123/time-logs', {
    taskId: 'task-456',
    duration: 90,
    description: 'Test',
    date: '2026-03-31',
    billable: true,
    rate: 100
  });
  
  expect(response.status).toBe(201);
  expect(response.data.data.billableCost).toBe(150);
});
```

---

## Common Issues & Solutions

### Issue: "Unauthorized" (401)

**Problem:** JWT token missing or invalid

**Solution:**
```javascript
// Make sure token is in Authorization header
const api = axios.create({
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});
```

### Issue: "Not Found" (404)

**Problem:** Project/resource doesn't exist

**Solution:**
```javascript
// Verify projectId is correct
console.log(projectId); // Should match actual project
```

### Issue: "Bad Request" (400)

**Problem:** Invalid input data

**Solution:**
```javascript
// Check required fields are present
console.log({
  taskId,      // Required for time logs
  duration,    // Required, must be number
  date         // Required, format: YYYY-MM-DD
});
```

---

## Documentation Reference

| Need | Read |
|------|------|
| 5-min overview | [WAVE-4-QUICK-START.md](./WAVE-4-QUICK-START.md) |
| All API endpoints | [WAVE-4-API-REFERENCE.md](./WAVE-4-API-REFERENCE.md) |
| Deep technical details | [WAVE-4-IMPLEMENTATION-SUMMARY.md](./WAVE-4-IMPLEMENTATION-SUMMARY.md) |
| Complete guide | [WAVE-4-COMPLETION.md](./WAVE-4-COMPLETION.md) |
| File inventory | [../WAVE-4-MANIFEST.md](../WAVE-4-MANIFEST.md) |
| Current status | [WAVE-4-STATUS.md](./WAVE-4-STATUS.md) |

---

## Next: What You Build

### Phase 1: Frontend Components (Week 1-2)
- [ ] Time entry quick-form
- [ ] Weekly timesheet view
- [ ] Manager approval interface
- [ ] Reporting dashboard (CFD, metrics)
- [ ] Client feedback form
- [ ] Feedback list view
- [ ] Asset upload widget
- [ ] Asset gallery

### Phase 2: Integration Testing (Week 2-3)
- [ ] Test all CRUD operations
- [ ] Test approval workflows
- [ ] Test error handling
- [ ] Test with real data volume
- [ ] Performance testing

### Phase 3: User Acceptance Testing (Week 3-4)
- [ ] Stakeholder review
- [ ] Bug fixes
- [ ] Refinements
- [ ] Documentation review

### Phase 4: Production Deployment (Week 4+)
- [ ] Final testing
- [ ] Deploy to production
- [ ] Monitor and support

---

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:cov

# Start in development mode
npm run dev

# Build for production
npm run build

# Start production build
npm start

# Watch mode for development
npm run test:watch
```

---

## Getting Help

1. **API Documentation** - See [WAVE-4-API-REFERENCE.md](./WAVE-4-API-REFERENCE.md)
2. **Code Examples** - Check `wave4.test.ts` for 40+ usage examples
3. **Architecture** - Read [WAVE-4-IMPLEMENTATION-SUMMARY.md](./WAVE-4-IMPLEMENTATION-SUMMARY.md)
4. **Status/Issues** - Check [WAVE-4-STATUS.md](./WAVE-4-STATUS.md)

---

**You're ready to go!** 🚀

Start with Feature 1 (Time Tracking), then move to Reporting, Feedback, and Assets.

Each feature is independent, so you can parallelize development.

---

*Last Updated: March 31, 2026*  
*Wave 4 Status: Production Ready*
