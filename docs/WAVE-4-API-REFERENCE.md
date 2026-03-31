# Wave 4: API Reference

## Base URL

```
/projects/:projectId
```

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

## Reporting Endpoints

### Get Cumulative Flow Diagram Data

```
GET /projects/:projectId/reports/cumulative-flow
```

**Query Parameters:**
- `from` (string, required): Start date (YYYY-MM-DD)
- `to` (string, required): End date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "message": "CFD data retrieved",
  "data": {
    "dates": ["2026-03-01", "2026-03-02", "2026-03-03"],
    "columns": {
      "backlog": [10, 10, 12],
      "todo": [5, 6, 7],
      "inProgress": [3, 4, 4],
      "review": [2, 2, 1],
      "done": [30, 31, 32]
    }
  }
}
```

---

### Get Cycle Time Analysis

```
GET /projects/:projectId/reports/cycle-time
```

**Response:**
```json
{
  "success": true,
  "message": "Cycle time data retrieved",
  "data": {
    "tasks": [
      {
        "taskId": "task-123",
        "title": "Login Form",
        "status": "done",
        "cycleTimeDays": 3.5,
        "createdAt": "2026-03-01T10:00:00Z",
        "completedAt": "2026-03-04T16:30:00Z"
      }
    ],
    "avgCycleTime": 3.2,
    "medianCycleTime": 2.8,
    "p90CycleTime": 7.1
  }
}
```

---

### Get Epic Progress

```
GET /projects/:projectId/reports/epic-progress
```

**Response:**
```json
{
  "success": true,
  "message": "Epic progress retrieved",
  "data": {
    "epics": [
      {
        "epicId": "epic-123",
        "title": "Client Dashboard",
        "stories": {
          "total": 8,
          "completed": 5,
          "inProgress": 2,
          "pending": 1
        },
        "percentage": 62.5,
        "projectedCompletion": "2026-04-15"
      }
    ]
  }
}
```

---

### Get Velocity Report

```
GET /projects/:projectId/reports/velocity/export
```

**Response:**
```json
{
  "success": true,
  "message": "Velocity report retrieved",
  "data": {
    "sprints": [
      {
        "sprintId": "sprint-123",
        "name": "Sprint 1",
        "plannedPoints": 50,
        "completedPoints": 48,
        "velocity": 48,
        "startDate": "2026-03-01",
        "endDate": "2026-03-14"
      }
    ]
  }
}
```

---

### Get Billing Report

```
GET /projects/:projectId/reports/billing/export
```

**Query Parameters:**
- `from` (string, required): Start date (YYYY-MM-DD)
- `to` (string, required): End date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "message": "Billing report retrieved",
  "data": {
    "summary": {
      "totalHours": 160,
      "totalCost": 16000,
      "averageHourlyRate": 100
    },
    "byUser": [
      {
        "userId": "user-123",
        "name": "John Doe",
        "hours": 40,
        "cost": 4000,
        "hourlyRate": 100
      }
    ]
  }
}
```

---

## Time Tracking Endpoints

### Create Time Log

```
POST /projects/:projectId/time-logs
```

**Request Body:**
```json
{
  "taskId": "task-123",
  "duration": 90,
  "description": "Implementation of login form",
  "date": "2026-03-31",
  "billable": true,
  "rate": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Time logged successfully",
  "data": {
    "_id": "log-123",
    "projectId": "proj-123",
    "taskId": "task-123",
    "userId": "user-123",
    "duration": 90,
    "description": "Implementation of login form",
    "date": "2026-03-31",
    "billable": true,
    "rate": 100,
    "billableCost": 150,
    "createdAt": "2026-03-31T14:30:00Z"
  }
}
```

---

### Get Task Time Logs

```
GET /projects/:projectId/time-logs/task/:taskId
```

**Response:**
```json
{
  "success": true,
  "message": "Task time logs retrieved",
  "data": {
    "taskId": "task-123",
    "logs": [
      {
        "_id": "log-123",
        "userId": "user-123",
        "duration": 90,
        "description": "Implementation",
        "date": "2026-03-31",
        "billable": true,
        "billableCost": 150
      }
    ],
    "totalMinutes": 90,
    "totalBillableCost": 150
  }
}
```

---

### Get User Time Logs

```
GET /projects/:projectId/time-logs/user/:userId
```

**Query Parameters:**
- `from` (string, optional): Start date (YYYY-MM-DD)
- `to` (string, optional): End date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "message": "User time logs retrieved",
  "data": {
    "userId": "user-123",
    "logs": [
      {
        "_id": "log-123",
        "taskId": "task-123",
        "duration": 90,
        "description": "Implementation",
        "date": "2026-03-31",
        "billable": true,
        "billableCost": 150
      }
    ],
    "totalMinutes": 480,
    "totalBillableCost": 800
  }
}
```

---

### Update Time Log

```
PUT /projects/:projectId/time-logs/:logId
```

**Request Body:**
```json
{
  "duration": 120,
  "description": "Updated: Full implementation",
  "billable": true,
  "rate": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Time log updated",
  "data": {
    "_id": "log-123",
    "duration": 120,
    "description": "Updated: Full implementation",
    "billable": true,
    "billableCost": 200,
    "updatedAt": "2026-03-31T15:00:00Z"
  }
}
```

---

### Delete Time Log

```
DELETE /projects/:projectId/time-logs/:logId
```

**Response:**
```json
{
  "success": true,
  "message": "Time log deleted"
}
```

---

## Timesheet Endpoints

### Get Weekly Timesheet

```
GET /projects/:projectId/timesheets/:userId
```

**Query Parameters:**
- `weekStart` (string, required): Week start date (YYYY-MM-DD, must be a Monday)

**Response:**
```json
{
  "success": true,
  "message": "Timesheet retrieved",
  "data": {
    "userId": "user-123",
    "weekStart": "2026-03-31",
    "weekEnd": "2026-04-06",
    "daily": {
      "2026-03-31": {
        "minutes": 480,
        "billableMinutes": 450,
        "entries": [
          {
            "taskId": "task-123",
            "duration": 90,
            "description": "Implementation"
          }
        ]
      },
      "2026-04-01": {
        "minutes": 420,
        "billableMinutes": 420,
        "entries": []
      }
    },
    "weekTotal": {
      "minutes": 2400,
      "billableMinutes": 2250,
      "billableHours": 37.5,
      "billableCost": 3750
    },
    "status": "pending"
  }
}
```

---

### Submit Timesheet

```
POST /projects/:projectId/timesheets/:userId/submit
```

**Request Body:**
```json
{
  "weekStart": "2026-03-31"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Timesheet submitted for approval",
  "data": {
    "status": "pending",
    "submittedAt": "2026-04-06T17:00:00Z"
  }
}
```

---

### Approve Timesheet

```
POST /projects/:projectId/timesheets/:userId/approve
```

**Request Body:**
```json
{
  "weekStart": "2026-03-31",
  "approverNotes": "Approved - looks good"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Timesheet approved",
  "data": {
    "status": "approved",
    "approvedAt": "2026-04-07T09:00:00Z",
    "approvedBy": "manager-123"
  }
}
```

---

### Reject Timesheet

```
POST /projects/:projectId/timesheets/:userId/reject
```

**Request Body:**
```json
{
  "weekStart": "2026-03-31",
  "rejectionReason": "Missing time entries for Monday"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Timesheet rejected",
  "data": {
    "status": "rejected",
    "rejectedAt": "2026-04-07T09:00:00Z",
    "rejectionReason": "Missing time entries for Monday"
  }
}
```

---

## Billing Endpoints

### Get User Billing Data

```
GET /projects/:projectId/billing/user/:userId
```

**Query Parameters:**
- `from` (string, optional): Start date (YYYY-MM-DD)
- `to` (string, optional): End date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "message": "User billing data retrieved",
  "data": {
    "userId": "user-123",
    "totalHours": 40,
    "totalCost": 4000,
    "hourlyRate": 100,
    "byTask": [
      {
        "taskId": "task-123",
        "taskTitle": "Login Form",
        "hours": 10,
        "cost": 1000
      }
    ]
  }
}
```

---

### Get Project Billing Data

```
GET /projects/:projectId/billing/project
```

**Query Parameters:**
- `from` (string, optional): Start date (YYYY-MM-DD)
- `to` (string, optional): End date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "message": "Project billing data retrieved",
  "data": {
    "projectId": "proj-123",
    "totalHours": 160,
    "totalCost": 16000,
    "byUser": [
      {
        "userId": "user-123",
        "name": "John Doe",
        "hours": 40,
        "cost": 4000,
        "hourlyRate": 100
      }
    ]
  }
}
```

---

## Client Feedback Endpoints

### Submit Feedback

```
POST /projects/:projectId/feedback
```

**Request Body:**
```json
{
  "clientId": "client-123",
  "clientName": "John Doe",
  "clientEmail": "john@example.com",
  "type": "bug",
  "title": "Login button not responding",
  "description": "Clicking the login button does nothing",
  "priority": 2,
  "attachments": ["https://cdn.example.com/screenshot.png"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback submitted successfully",
  "data": {
    "_id": "feedback-123",
    "projectId": "proj-123",
    "clientId": "client-123",
    "clientName": "John Doe",
    "type": "bug",
    "title": "Login button not responding",
    "status": "new",
    "priority": 2,
    "createdAt": "2026-03-31T14:30:00Z"
  }
}
```

---

### Get Project Feedback

```
GET /projects/:projectId/feedback
```

**Query Parameters:**
- `type` (string, optional): Filter by type (bug|feature|question|general)
- `status` (string, optional): Filter by status (new|reviewed|in_progress|completed|closed)
- `priority` (number, optional): Filter by priority (1-5)
- `limit` (number, optional): Results per page (default: 50)
- `skip` (number, optional): Skip results (default: 0)

**Response:**
```json
{
  "success": true,
  "message": "Project feedback retrieved",
  "data": {
    "feedback": [
      {
        "_id": "feedback-123",
        "clientName": "John Doe",
        "type": "bug",
        "title": "Login button not responding",
        "status": "new",
        "priority": 2,
        "createdAt": "2026-03-31T14:30:00Z"
      }
    ],
    "total": 25
  }
}
```

---

### Get Feedback by ID

```
GET /projects/:projectId/feedback/:feedbackId
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback retrieved",
  "data": {
    "_id": "feedback-123",
    "projectId": "proj-123",
    "clientId": "client-123",
    "clientName": "John Doe",
    "clientEmail": "john@example.com",
    "type": "bug",
    "title": "Login button not responding",
    "description": "Clicking the login button does nothing",
    "priority": 2,
    "status": "new",
    "attachments": ["url/screenshot.png"],
    "taskKey": null,
    "createdAt": "2026-03-31T14:30:00Z"
  }
}
```

---

### Update Feedback Status

```
PUT /projects/:projectId/feedback/:feedbackId/status
```

**Request Body:**
```json
{
  "status": "in_progress"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback status updated",
  "data": {
    "_id": "feedback-123",
    "status": "in_progress",
    "updatedAt": "2026-03-31T15:00:00Z"
  }
}
```

---

### Link Feedback to Task

```
PUT /projects/:projectId/feedback/:feedbackId/link-task
```

**Request Body:**
```json
{
  "taskKey": "PROJ-123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback linked to task",
  "data": {
    "_id": "feedback-123",
    "taskKey": "PROJ-123",
    "linkedAt": "2026-03-31T15:15:00Z"
  }
}
```

---

### Delete Feedback

```
DELETE /projects/:projectId/feedback/:feedbackId
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback deleted"
}
```

---

### Get Client Feedback

```
GET /projects/:projectId/feedback/client/:clientId
```

**Response:**
```json
{
  "success": true,
  "message": "Client feedback retrieved",
  "data": {
    "clientId": "client-123",
    "feedback": [
      {
        "_id": "feedback-123",
        "type": "bug",
        "title": "Login button not responding",
        "status": "in_progress",
        "createdAt": "2026-03-31T14:30:00Z"
      }
    ],
    "total": 5
  }
}
```

---

### Get Feedback Statistics

```
GET /projects/:projectId/feedback/stats
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback statistics retrieved",
  "data": {
    "byType": {
      "bug": 12,
      "feature": 5,
      "question": 8,
      "general": 3
    },
    "byStatus": {
      "new": 4,
      "reviewed": 8,
      "in_progress": 5,
      "completed": 10,
      "closed": 1
    },
    "byPriority": {
      "1": 5,
      "2": 8,
      "3": 10,
      "4": 3,
      "5": 2
    },
    "avgResolutionTime": 3.2
  }
}
```

---

## Asset Preview Endpoints

### Upload Asset

```
POST /projects/:projectId/assets
```

**Request Body:**
```json
{
  "taskId": "task-456",
  "url": "https://cdn.example.com/design-v2.figma",
  "name": "Design System v2",
  "type": "figma",
  "size": 2400000,
  "thumbnailUrl": "https://cdn.example.com/thumb.png",
  "width": 1920,
  "height": 1080,
  "format": "figma"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Asset uploaded successfully",
  "data": {
    "_id": "asset-123",
    "projectId": "proj-123",
    "taskId": "task-456",
    "uploadedBy": "user-123",
    "name": "Design System v2",
    "type": "figma",
    "url": "https://cdn.example.com/design-v2.figma",
    "size": 2400000,
    "width": 1920,
    "height": 1080,
    "format": "figma",
    "createdAt": "2026-03-31T14:30:00Z"
  }
}
```

---

### Get Project Assets

```
GET /projects/:projectId/assets
```

**Query Parameters:**
- `type` (string, optional): Filter by type (image|video|figma|document|other)
- `uploadedBy` (string, optional): Filter by uploader
- `limit` (number, optional): Results per page (default: 100)
- `skip` (number, optional): Skip results (default: 0)

**Response:**
```json
{
  "success": true,
  "message": "Project assets retrieved",
  "data": [
    {
      "_id": "asset-123",
      "name": "Design System v2",
      "type": "figma",
      "size": 2400000,
      "uploadedBy": "user-123",
      "createdAt": "2026-03-31T14:30:00Z"
    }
  ],
  "total": 45
}
```

---

### Get Asset Details

```
GET /projects/:projectId/assets/:assetId
```

**Response:**
```json
{
  "success": true,
  "message": "Asset retrieved",
  "data": {
    "_id": "asset-123",
    "projectId": "proj-123",
    "taskId": "task-456",
    "uploadedBy": "user-123",
    "name": "Design System v2",
    "type": "figma",
    "url": "https://cdn.example.com/design-v2.figma",
    "thumbnailUrl": "https://cdn.example.com/thumb.png",
    "size": 2400000,
    "width": 1920,
    "height": 1080,
    "format": "figma",
    "metadata": {},
    "createdAt": "2026-03-31T14:30:00Z"
  }
}
```

---

### Get Task Assets

```
GET /projects/:projectId/assets/task/:taskId
```

**Query Parameters:**
- `type` (string, optional): Filter by type
- `limit` (number, optional): Results per page (default: 50)
- `skip` (number, optional): Skip results (default: 0)

**Response:**
```json
{
  "success": true,
  "message": "Task assets retrieved",
  "data": [
    {
      "_id": "asset-123",
      "name": "Design System v2",
      "type": "figma",
      "size": 2400000,
      "createdAt": "2026-03-31T14:30:00Z"
    }
  ],
  "total": 5
}
```

---

### Update Asset

```
PUT /projects/:projectId/assets/:assetId
```

**Request Body:**
```json
{
  "name": "Design System v3",
  "width": 1920,
  "height": 1080
}
```

**Response:**
```json
{
  "success": true,
  "message": "Asset updated",
  "data": {
    "_id": "asset-123",
    "name": "Design System v3",
    "width": 1920,
    "height": 1080,
    "updatedAt": "2026-03-31T15:00:00Z"
  }
}
```

---

### Delete Asset

```
DELETE /projects/:projectId/assets/:assetId
```

**Response:**
```json
{
  "success": true,
  "message": "Asset deleted"
}
```

---

### Delete Task Assets

```
DELETE /projects/:projectId/assets/task/:taskId
```

**Response:**
```json
{
  "success": true,
  "message": "Task assets deleted",
  "deletedCount": 5
}
```

---

### Get Asset Statistics

```
GET /projects/:projectId/assets/stats
```

**Response:**
```json
{
  "success": true,
  "message": "Asset statistics retrieved",
  "data": {
    "total": 45,
    "byType": {
      "image": 20,
      "video": 8,
      "figma": 10,
      "document": 5,
      "other": 2
    },
    "totalSizeBytes": 512000000,
    "topUploaders": [
      {
        "uploadedBy": "user-123",
        "count": 15,
        "totalSize": 150000000
      }
    ]
  }
}
```

---

### Get Recent Assets

```
GET /projects/:projectId/assets/recent
```

**Query Parameters:**
- `limit` (number, optional): Number of assets to return (default: 10)

**Response:**
```json
{
  "success": true,
  "message": "Recent assets retrieved",
  "data": [
    {
      "_id": "asset-123",
      "name": "Design System v2",
      "type": "figma",
      "size": 2400000,
      "uploadedBy": "user-123",
      "createdAt": "2026-03-31T14:30:00Z"
    }
  ]
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "URL and name are required",
  "error": "Bad Request"
}
```

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Asset not found",
  "error": "Not Found"
}
```

### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 500 Internal Server Error

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

---

## Authentication

All endpoints require JWT authentication:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.example.com/projects/proj-123/reports/cycle-time
```

---

## Rate Limiting

No rate limits currently enforced. Consider implementing in production:
- 100 requests/minute per user
- 1000 requests/minute per IP

---

**Last Updated:** 2026-03-31
