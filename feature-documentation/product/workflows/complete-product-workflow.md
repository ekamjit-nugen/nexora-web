# Product Feature - Complete Workflow

**Feature:** Product Management  
**Version:** 1.0.0  
**Last Updated:** March 31, 2026

---

## Overview

The Product workflow covers the complete lifecycle of product management in Nexora, from login through product creation, management, and team collaboration. This workflow integrates multiple roles (Admin, Product Manager, Developer, Viewer) and demonstrates how different users interact with products across the platform.

---

## Core Workflow: Complete Product Lifecycle

### Phase 1: Authentication & Access

```
START
  ↓
┌─────────────────────────────────────────┐
│ User Opens Nexora Platform              │
│ - Navigate to login page                │
│ - See: Email/Password fields            │
│ - See: "Sign in with Google/GitHub"     │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ User Enters Credentials                 │
│ - Email: user@company.com               │
│ - Password: ••••••••                    │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Authentication Service Validates        │
│ - Check email exists                    │
│ - Verify password (bcrypt)              │
│ - Generate JWT token                    │
│ - Set refresh token (HttpOnly cookie)   │
└─────────────────────────────────────────┘
  ↓
Success? ──No──→ Show Error Message
  │              ↓
  │         User Retries or Resets Password
  │              ↓
  └──────────────┘
  │
 Yes
  ↓
┌─────────────────────────────────────────┐
│ System Creates Session                  │
│ - Store JWT in localStorage             │
│ - Load user profile (name, avatar, role)│
│ - Cache user permissions                │
│ - Initialize WebSocket connection       │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Redirect to Dashboard                   │
│ - Show: Products user has access to     │
│ - Show: Recent activity                 │
│ - Show: Quick actions menu              │
└─────────────────────────────────────────┘
```

### Phase 2: Product Discovery & Selection

```
Dashboard Loaded
  ↓
┌─────────────────────────────────────────┐
│ Display Products List                   │
│ Based on User Role:                     │
│ - Admin: All products                   │
│ - Product Manager: Own + shared         │
│ - Developer: Assigned products          │
│ - Viewer: Read-only view                │
└─────────────────────────────────────────┘
  ↓
  ├─ User Action: Filter by Status
  │  │ (Active, Archived, Draft)
  │  └→ API: GET /products?status=active
  │
  ├─ User Action: Search by Name
  │  │ (Real-time autocomplete)
  │  └→ API: GET /products/search?q=payment
  │
  └─ User Action: Sort by Date/Name
     │ (Ascending/Descending)
     └→ API: GET /products?sort=createdAt
  ↓
┌─────────────────────────────────────────┐
│ User Selects a Product                  │
│ Example: "Payment Processing Platform"  │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Load Product Details                    │
│ - Product name, description, status     │
│ - Team members assigned                 │
│ - Linked projects & tasks               │
│ - Recent activity timeline              │
│ - Product metrics & KPIs                │
└─────────────────────────────────────────┘
  ↓
API: GET /products/:productId
  ↓
Display Product Dashboard
```

### Phase 3: Product Management (by Role)

#### 3A: Admin - Full Access

```
Admin Views Product
  ↓
┌─────────────────────────────────────────┐
│ Admin Options Available:                │
│ ✓ Edit product details                  │
│ ✓ Manage product settings               │
│ ✓ Add/remove team members               │
│ ✓ Assign roles & permissions            │
│ ✓ View all analytics                    │
│ ✓ Archive/delete product                │
│ ✓ Manage integrations                   │
│ ✓ View audit logs                       │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Admin Updates Product Details           │
│ - Name: "Payment Processing Platform"   │
│ - Description: Full paragraph           │
│ - Category: Backend/Finance             │
│ - Priority: High                        │
│ - Status: Active                        │
└─────────────────────────────────────────┘
  ↓
API: PUT /products/:productId
{
  name: "Payment Processing Platform v2",
  description: "...",
  category: "Backend",
  priority: "High",
  status: "Active"
}
  ↓
┌─────────────────────────────────────────┐
│ Changes Saved                           │
│ - Audit log entry created               │
│ - Team notified (if configured)         │
│ - Cache invalidated                     │
└─────────────────────────────────────────┘
```

#### 3B: Product Manager - Manage Own Products

```
Product Manager Views Product
  ↓
┌─────────────────────────────────────────┐
│ PM Options Available:                   │
│ ✓ Edit product details (name, desc)     │
│ ✓ Update status (Active→Archive)        │
│ ✓ Add team members                      │
│ ✓ Create linked projects                │
│ ✓ View analytics & reports              │
│ ✗ Delete product (Admin only)           │
│ ✗ Manage permissions (Admin only)       │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ PM Creates a New Project                │
│ From Product Dashboard:                 │
│ - Click "New Project" button            │
│ - Enter project name & description      │
│ - Set initial status                    │
│ - Assign team members                   │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Link Project to Product                 │
│ - Project inherits product metadata     │
│ - Team members get notified             │
│ - Project appears in product timeline   │
└─────────────────────────────────────────┘
  ↓
API: POST /products/:productId/projects
{
  name: "Payment Gateway Integration",
  description: "...",
  startDate: "2026-04-01",
  teamMembers: ["user1", "user2"]
}
```

#### 3C: Developer - View & Contribute

```
Developer Views Product
  ↓
┌─────────────────────────────────────────┐
│ Developer Options Available:            │
│ ✓ View product details & projects      │
│ ✓ View assigned tasks/sprints           │
│ ✓ Update task status                    │
│ ✓ Log time entries                      │
│ ✓ Leave comments & feedback             │
│ ✗ Modify product settings               │
│ ✗ Manage team members                   │
│ ✗ View analytics (limited view only)    │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Developer Views Assigned Tasks          │
│ - Click "My Tasks" in product           │
│ - Filter by status (Todo, In Progress) │
│ - View task details & acceptance       │
│   criteria                              │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Developer Starts Working on Task        │
│ 1. Task: "Implement payment validation" │
│ 2. Click "Start Work" button            │
│ 3. Status changes: Todo → In Progress   │
│ 4. Timer starts automatically           │
└─────────────────────────────────────────┘
  ↓
API: PATCH /tasks/:taskId/status
{
  status: "In Progress",
  startedAt: "2026-03-31T10:00:00Z"
}
  ↓
┌─────────────────────────────────────────┐
│ Developer Works on Task                 │
│ - Updates task progress in comments     │
│ - Logs time: "90 minutes implementation"│
│ - Requests code review when ready       │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Log Time Entry                          │
│ - Duration: 90 minutes                  │
│ - Description: "Payment validation logic"
│ - Billable: Yes                         │
│ - Rate: $100/hour                       │
└─────────────────────────────────────────┘
  ↓
API: POST /projects/:projectId/time-logs
{
  taskId: "task-123",
  duration: 90,
  description: "Implemented validation logic",
  date: "2026-03-31",
  billable: true,
  rate: 100
}
  ↓
┌─────────────────────────────────────────┐
│ Time Logged Successfully                │
│ - Billable cost: $150 (90/60 * 100)     │
│ - Added to weekly timesheet             │
│ - Manager notified for approval         │
└─────────────────────────────────────────┘
```

#### 3D: Viewer - Read-Only Access

```
Viewer Accesses Product
  ↓
┌─────────────────────────────────────────┐
│ Viewer Options Available:               │
│ ✓ View product details                  │
│ ✓ View public analytics                 │
│ ✓ View task status                      │
│ ✗ Create/edit anything                  │
│ ✗ Access team management                │
│ ✗ View sensitive data                   │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Viewer Browses Product                  │
│ - Reads product overview                │
│ - Views public project list             │
│ - Checks deployment status              │
│ - Reviews public metrics                │
└─────────────────────────────────────────┘
```

### Phase 4: Collaboration & Team Management

```
Product Manager in Team Tab
  ↓
┌─────────────────────────────────────────┐
│ Team Management Interface               │
│ Shows:                                  │
│ - Current team members + roles          │
│ - Invites pending                       │
│ - Team activity log                     │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ PM Adds New Team Member                 │
│ - Click "Invite Member" button          │
│ - Select from company directory         │
│ - Choose role (Admin/Lead/Dev/Viewer)   │
│ - Set permissions                       │
└─────────────────────────────────────────┘
  ↓
API: POST /products/:productId/members
{
  userId: "user-new",
  role: "Developer",
  permissions: ["viewProject", "editTask", "logTime"]
}
  ↓
┌─────────────────────────────────────────┐
│ Invite Sent                             │
│ - Email sent to new member              │
│ - Invite shows in their notifications   │
│ - 14-day expiration set                 │
└─────────────────────────────────────────┘
  ↓
New Member Receives Invite
  ↓
┌─────────────────────────────────────────┐
│ New Member Accepts Invite               │
│ - Clicks link in email                  │
│ - Confirm acceptance                    │
│ - Redirected to product                 │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Team Updated                            │
│ - New member added to team list         │
│ - Permissions granted                   │
│ - Onboarding email sent                 │
│ - Activity notification posted          │
└─────────────────────────────────────────┘
```

### Phase 5: Product Analytics & Reporting

```
Admin/PM Clicks "Analytics" Tab
  ↓
┌─────────────────────────────────────────┐
│ Analytics Dashboard Loads               │
│ Shows:                                  │
│ - Product overview (age, status, team)  │
│ - Project statistics                    │
│ - Team activity metrics                 │
│ - Timeline of key events                │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Admin Views Detailed Metrics            │
│ - Total projects: 12                    │
│ - Active projects: 8                    │
│ - Team size: 15 people                  │
│ - Average time-to-completion: 3.2 days  │
│ - Total time logged: 850 hours          │
│ - Total cost: $42,500                   │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ View Trends                             │
│ - Charts showing growth over time       │
│ - Team expansion pattern                │
│ - Project completion rate               │
│ - Cost vs budget tracking               │
└─────────────────────────────────────────┘
  ↓
API: GET /products/:productId/analytics
  ↓
┌─────────────────────────────────────────┐
│ Export Report                           │
│ - Format: PDF or CSV                    │
│ - Include: All metrics & charts         │
│ - Date range: User selected             │
└─────────────────────────────────────────┘
  ↓
API: GET /products/:productId/reports/export
```

### Phase 6: Settings & Configuration

```
Admin in Settings
  ↓
┌─────────────────────────────────────────┐
│ Product Settings Page                   │
│ Sections:                               │
│ 1. General (name, desc, category)       │
│ 2. Team & Permissions                   │
│ 3. Integration Settings                 │
│ 4. Notification Preferences             │
│ 5. Billing & Pricing                    │
│ 6. Advanced Settings                    │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Admin Updates Notification Settings     │
│ - Enable team updates                   │
│ - Task assignment notifications         │
│ - Weekly summary email                  │
│ - Slack integration                     │
└─────────────────────────────────────────┘
  ↓
API: PUT /products/:productId/settings
{
  notifications: {
    taskAssignment: true,
    weeklyEmail: true,
    slackIntegration: true,
    mentionNotifications: true
  }
}
```

### Phase 7: Logout

```
User Clicks Profile → Logout
  ↓
┌─────────────────────────────────────────┐
│ Clear Session                           │
│ - Remove JWT from localStorage          │
│ - Clear refresh token cookie            │
│ - Close WebSocket connection            │
│ - Clear cached user data                │
└─────────────────────────────────────────┘
  ↓
API: POST /auth/logout
  ↓
┌─────────────────────────────────────────┐
│ Redirect to Login Page                  │
│ - Show goodbye message (if configured)  │
│ - Clear form fields                     │
└─────────────────────────────────────────┘
  ↓
END
```

---

## Role-Based Access Matrix

| Action | Admin | PM | Dev | Viewer |
|--------|-------|-----|-----|--------|
| View Product | ✅ | ✅ | ✅ | ✅ |
| Edit Details | ✅ | ✅ | ❌ | ❌ |
| Manage Team | ✅ | ✅ | ❌ | ❌ |
| Create Project | ✅ | ✅ | ❌ | ❌ |
| View Tasks | ✅ | ✅ | ✅ | ✅ |
| Update Tasks | ✅ | ✅ | ✅ | ❌ |
| Log Time | ✅ | ✅ | ✅ | ❌ |
| View Analytics | ✅ | ✅ | ⚠️* | ❌ |
| Delete Product | ✅ | ❌ | ❌ | ❌ |

*Limited to assigned work only

---

## Simulation Flow Example

### Scenario: New Developer Onboarding to Payment Product

```
Day 1: 10:00 AM - New Developer "Sarah" Receives Invite
  ↓
1. Sarah logs in to Nexora for first time
   - Email: sarah@company.com
   - Password set via email link
   ↓
2. Redirected to Dashboard
   - See 1 product: "Payment Processing Platform"
   - See 3 assigned projects
   - See 5 pending tasks
   ↓
3. Views Product Details
   - Reads product overview
   - Sees team members (15 people)
   - Views project timeline
   ↓
Day 1: 10:30 AM - Sarah Starts First Task
  ↓
4. Views "Implement payment validation" task
   - Reads acceptance criteria
   - Reviews code review requirements
   - Checks dependencies
   ↓
5. Clicks "Start Work"
   - Status: Todo → In Progress
   - Timer starts
   - Notifies PM
   ↓
Day 1: 2:00 PM - Sarah Logs Time
  ↓
6. Task progress: 75% complete
   - Logs 4 hours of work
   - Cost tracked: $400 (4 hours × $100/hr)
   - Added to daily timesheet
   ↓
Day 1: 5:00 PM - Sarah Logs Time Again
  ↓
7. Task completed
   - Logs final 1 hour
   - Total time: 5 hours = $500
   - Updates task status: In Progress → Review
   - Comments: "Ready for code review"
   ↓
Day 2: 10:00 AM - PM Reviews
  ↓
8. PM gets notification about completed task
   - Reviews Sarah's work
   - Approves timesheet
   - Moves task to Done
   ↓
Day 2: 10:30 AM - Sarah Submits Weekly Timesheet
  ↓
9. Week total:
   - 40 hours logged
   - All billable
   - Total: $4,000 cost
   - Status: Pending manager approval
   ↓
10. PM reviews and approves
    - Timesheet marked approved
    - Billing finalized
    - Invoice generated
```

---

## Error Handling Scenarios

### Scenario 1: Unauthorized Access Attempt

```
Developer tries to delete a product
  ↓
API: DELETE /products/:productId
{
  Authorization: "Bearer user-dev-token"
}
  ↓
Check permission
  ↓
Error: 403 Forbidden
{
  statusCode: 403,
  message: "You don't have permission to delete products",
  requiredRole: "Admin",
  yourRole: "Developer"
}
  ↓
Show error notification to user
  ↓
Log attempt (audit trail)
```

### Scenario 2: Product Not Found

```
User accesses non-existent product
  ↓
API: GET /products/invalid-id
  ↓
Error: 404 Not Found
{
  statusCode: 404,
  message: "Product not found",
  productId: "invalid-id"
}
  ↓
Redirect to products list
  ↓
Show "Product not found" message
```

### Scenario 3: Concurrent Edit Conflict

```
Two PMs editing product simultaneously
  ↓
PM1 saves changes at 10:00:00
PM2 saves changes at 10:00:01
  ↓
PM2's request arrives after PM1
  ↓
Check: Resource version mismatch
  ↓
Error: 409 Conflict
{
  statusCode: 409,
  message: "This product was modified by another user",
  lastModifiedBy: "PM1 (John Doe)",
  lastModifiedAt: "2026-03-31T10:00:00Z",
  suggestion: "Reload to see latest changes"
}
  ↓
PM2 sees notification to reload
  ↓
PM2 clicks reload → sees PM1's changes
```

---

## Data Flow Diagram

```
┌─────────────────┐
│  Frontend UI    │
│  (React)        │
└────────┬────────┘
         │
         ├─→ Login Form ──────────────┐
         │                            │
         ├─→ Product List ────────────┤
         │                            │
         ├─→ Product Details ─────────┤
         │                            ├─→ [REST API Gateway] ──→ [Auth Service]
         ├─→ Team Management ────────┤                           │
         │                            ├─→ [Project Service] ─────┤
         ├─→ Analytics Dashboard ────┤                           │
         │                            ├─→ [Task Service] ────────┤
         └─→ Settings Page ──────────┘                           │
                                        ├─→ [MongoDB]
                                        │
                                        └─→ [Redis Cache]
```

---

**End of Product Workflow Documentation**

Next: See [use-cases.md](../use-cases/product-use-cases.md) for detailed use cases
