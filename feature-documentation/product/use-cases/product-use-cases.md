# Product Feature - Use Cases

**Feature:** Product Management  
**Version:** 1.0.0  
**Last Updated:** March 31, 2026

---

## Table of Contents

1. [Admin Use Cases](#admin-use-cases)
2. [Product Manager Use Cases](#product-manager-use-cases)
3. [Developer Use Cases](#developer-use-cases)
4. [Viewer Use Cases](#viewer-use-cases)
5. [Cross-Role Use Cases](#cross-role-use-cases)

---

## Admin Use Cases

### UC-1: Create New Product

**Actor:** Admin  
**Precondition:** Admin is logged in and has admin credentials

**Main Flow:**
1. Admin navigates to Products → "+ New Product"
2. Fills in product form:
   - Name: "Mobile Banking App"
   - Description: "Consumer-facing banking application"
   - Category: "Mobile/Frontend"
   - Icon: Upload or select
3. Sets initial team members (optional)
4. Clicks "Create Product"
5. System validates input
6. Creates product in database
7. Adds audit log entry
8. Shows success message
9. Redirects to product detail page

**Postcondition:** Product created and visible in products list

**Alternate Flow A: Duplicate Existing Product**
- Admin clicks "Duplicate" on existing product
- System copies all settings except name/description
- Admin modifies new product details
- Creates new product with copied configuration

**Alternate Flow B: Import Product from Template**
- Admin selects "From Template"
- Chooses template (e.g., "Web App", "Mobile App", "Backend Service")
- Template provides default structure
- Admin customizes as needed

---

### UC-2: Manage Product Permissions

**Actor:** Admin  
**Precondition:** Admin viewing product details

**Main Flow:**
1. Admin clicks "Permissions" tab
2. Sees permission matrix for all roles
3. For each role, reviews available actions:
   - View Product: ✅
   - Edit Details: Varies by role
   - Manage Team: Varies by role
   - View Analytics: Varies by role
4. Admin wants to grant "Viewer" role more access
5. Clicks "Edit Role Settings"
6. Checks additional permissions
7. Saves changes
8. System updates role permissions
9. Existing viewers now have new permissions
10. Audit log records change

**Postcondition:** Role permissions updated

**Alternate Flow: Add Custom Role**
- Admin clicks "Create Custom Role"
- Enters role name: "Product Analyst"
- Selects specific permissions (mix of different levels)
- Sets role description
- Saves custom role
- Can now assign this role to users

---

### UC-3: Archive/Delete Product

**Actor:** Admin  
**Precondition:** Admin has product selected

**Main Flow: Archive (Safe)**
1. Admin clicks "Settings" → "Danger Zone"
2. Clicks "Archive Product"
3. System shows confirmation dialog
   - "Archive product? This action is reversible"
   - Shows affected projects/tasks
4. Admin confirms
5. Product marked as archived
6. Product hidden from main list (shows in archived filter)
7. All linked projects remain accessible (read-only)
8. Audit log entry created

**Postcondition:** Product archived but recoverable

**Main Flow: Delete (Permanent)**
1. Admin clicks "Settings" → "Danger Zone"
2. Clicks "Permanently Delete Product"
3. System shows strong warning:
   - "⚠️ This action CANNOT be undone"
   - "Deleting affects X projects and Y tasks"
   - Shows 7-day grace period option
4. Admin chooses:
   - Option A: Delete immediately (requires confirmation code)
   - Option B: Schedule deletion in 7 days (sends daily reminders)
5. If immediate delete:
   - Admin enters confirmation code shown on screen
   - Confirms again
6. System deletes product and all related data
7. Sends notification to team members
8. Creates audit log entry

**Postcondition:** Product deleted permanently

---

### UC-4: View Audit Logs

**Actor:** Admin  
**Precondition:** Admin on product details page

**Main Flow:**
1. Admin clicks "Activity" → "Audit Logs"
2. System shows chronological list of all changes:
   ```
   2026-03-31 15:30 - John Doe - Created Product
   2026-03-31 14:45 - Jane Smith - Updated Name to "v2"
   2026-03-31 14:20 - Mike Johnson - Added Team Member (Sarah)
   2026-03-31 13:00 - John Doe - Changed Status to Active
   ```
3. Admin clicks on any entry to see details:
   - What changed (old value → new value)
   - Who made the change
   - When it happened
   - IP address / browser info
4. Admin can filter by:
   - User who made change
   - Type of change
   - Date range
5. Admin exports audit log as CSV

**Postcondition:** Audit log reviewed and potentially exported

---

## Product Manager Use Cases

### UC-5: Create Linked Project

**Actor:** Product Manager  
**Precondition:** PM viewing product with "Manage Projects" permission

**Main Flow:**
1. PM on product detail page
2. Clicks "+ Create Project" button
3. Project creation dialog appears
4. Fills in:
   - Project name: "Mobile App - iOS Development"
   - Description: "..."
   - Start date: "2026-04-01"
   - End date: "2026-06-30"
   - Team members: Selects 3 developers
5. Links to product: (already selected, auto-fills product name)
6. Sets initial sprint (optional)
7. Clicks "Create Project"
8. System:
   - Creates project linked to product
   - Adds team members with permissions
   - Sends invitations/notifications
   - Initializes project structure
9. Redirects to project detail page

**Postcondition:** Project created and linked to product

---

### UC-6: Update Product Information

**Actor:** Product Manager  
**Precondition:** PM has edit permission on product

**Main Flow:**
1. PM clicks "Edit Product" button
2. Product edit form appears:
   ```
   Name: "Payment Processing Platform"
   Description: [text editor]
   Category: [dropdown]
   Priority: [High/Medium/Low]
   Status: [Active/Paused/Archived]
   Owner: [current PM]
   Budget: [numeric]
   Target Launch: [date picker]
   ```
3. PM updates multiple fields
4. Clicks "Save Changes"
5. System validates all fields
6. Updates product in database
7. Invalidates cache
8. Creates activity log entry: "PM Updated product details"
9. Shows success notification

**Postcondition:** Product details updated

**Alternate Flow: Validation Error**
- PM leaves "Name" field empty
- System shows validation error
- Form highlights required field
- PM fills in required field
- Submits again successfully

---

### UC-7: Add Team Member to Product

**Actor:** Product Manager  
**Precondition:** PM on product team page

**Main Flow:**
1. PM clicks "+ Add Member" button
2. Member selection modal appears
3. PM searches for team member: "Sarah Chen"
4. Selects Sarah from results
5. Chooses role: "Developer"
6. Optionally adds note: "iOS development"
7. Clicks "Add Member"
8. System:
   - Verifies user exists
   - Checks they're not already member
   - Assigns role and permissions
   - Sends invitation email
   - Creates activity entry
9. Sarah appears in team list with "Invited" status

**Postcondition:** Team member invited and added to product

**Alternate Flow: Add Multiple Members**
- PM clicks "+ Add Member"
- Selects 3 developers at once
- Assigns same role to all
- Clicks "Add All"
- System processes all additions
- Shows "3 members added"

---

### UC-8: Track Project Progress

**Actor:** Product Manager  
**Precondition:** PM viewing product with multiple linked projects

**Main Flow:**
1. PM clicks "Projects" tab
2. Sees list of all linked projects with status:
   ```
   ✓ Phase 1: Core Features [Complete] - 40/40 tasks
   ⏳ Phase 2: API Integration [In Progress] - 18/35 tasks
   📅 Phase 3: Mobile Client [Planned] - 0/45 tasks
   ```
3. PM clicks on Phase 2 to drill down
4. Sees tasks organized by sprint
5. PM views analytics:
   - On-time completion rate: 95%
   - Velocity: 25 story points/sprint
   - Cycle time: 3.2 days average
6. PM identifies risk: "Mobile Client" phase may miss deadline
7. Clicks "Allocate Resources"
8. Adds 2 more developers to that phase
9. System recalculates timeline
10. New estimate: On track for deadline

**Postcondition:** Projects tracked and resources adjusted

---

## Developer Use Cases

### UC-9: View Assigned Tasks

**Actor:** Developer  
**Precondition:** Developer logged in and assigned to product/project

**Main Flow:**
1. Developer clicks "My Work" in sidebar
2. Sees filtered view: Tasks assigned to them
3. Tasks grouped by status:
   ```
   📋 Todo (5 tasks)
   ⚙️ In Progress (3 tasks)
   👀 In Review (1 task)
   ✓ Done (12 tasks this week)
   ```
4. Developer clicks on "Implement payment validation"
5. Task detail panel opens:
   - Title, description
   - Acceptance criteria (checklist)
   - Linked test cases
   - Code review requirements
   - Assigned to: Dev (self)
   - Due date: 2026-04-02
6. Developer reads criteria:
   - ✓ Validates card numbers (Luhn)
   - ✓ Validates expiry date
   - ✓ Validates CVV
   - ✓ 95%+ test coverage required
   - ✓ Code review by senior dev
7. Clicks "Start Work"

**Postcondition:** Developer ready to work on task

---

### UC-10: Log Time Entry

**Actor:** Developer  
**Precondition:** Developer working on a task

**Main Flow:**
1. Developer has been working for 2 hours on payment validation task
2. Clicks "Log Time" in task detail
3. Time entry form appears:
   ```
   Task: Implement payment validation
   Duration: [2] hours
   Minutes: [0]
   Date: [2026-03-31]
   Description: "Implemented validation logic and unit tests"
   Billable: [checkbox] ✓
   Rate: $100/hour
   ```
4. System auto-calculates: Cost = 2 × $100 = $200
5. Developer clicks "Log Time"
6. System:
   - Creates time log entry
   - Adds to daily timesheet
   - Calculates billable cost
   - Updates task time estimation
7. Shows confirmation: "✓ 2 hours logged ($200)"

**Postcondition:** Time logged and tracked

**Alternate Flow: Log Multiple Entries**
- Developer logs time for 3 different tasks
- Each entry saved independently
- Daily total shown: 8.5 hours = $850

---

### UC-11: Submit Weekly Timesheet

**Actor:** Developer  
**Precondition:** Developer has logged time during week

**Main Flow:**
1. Developer clicks "Timesheets" in sidebar
2. Views current week (Mar 31 - Apr 6):
   ```
   Mon (Mar 31): 8 hours, $800, ✓ Complete
   Tue (Apr 1):  8 hours, $800, ✓ Complete
   Wed (Apr 2):  8 hours, $800, ✓ Complete
   Thu (Apr 3):  8 hours, $800, ✓ Complete
   Fri (Apr 4):  6 hours, $600, ⚠️ Incomplete
   ───────────────────────
   Total: 38 hours, $3,800
   ```
3. Developer fills remaining time on Friday
4. Reviews all entries for accuracy
5. Clicks "Submit for Approval"
6. Dialog shows:
   - Total billable hours: 40
   - Total billable cost: $4,000
   - Manager assigned: Jane Smith
   - Note: "Submitting for approval"
7. Developer clicks "Submit"
8. System:
   - Locks timesheet (prevents further edits)
   - Sends to manager for approval
   - Notifies manager (email + notification)
   - Marks status as "Pending Approval"
9. Shows: "✓ Timesheet submitted for approval"

**Postcondition:** Timesheet submitted and awaiting manager approval

**Alternate Flow: Reject and Revise**
- Manager rejects timesheet: "Friday entry needs description"
- Developer notified
- Developer clicks "Revise Timesheet"
- Updates the problematic entry
- Resubmits
- Manager approves

---

### UC-12: Request Code Review

**Actor:** Developer  
**Precondition:** Developer completed task and ready for review

**Main Flow:**
1. Developer finishes implementing payment validation
2. Updates task status: "In Progress" → "In Review"
3. Adds comment: "Ready for code review, all tests passing"
4. Clicks "Request Review" button
5. Review request dialog:
   ```
   Reviewers: [Select team member(s)]
   Priority: [Normal/Urgent/Low]
   Message: "Please review the validation logic"
   Link to PR: [GitHub link]
   ```
6. Developer selects 2 senior developers as reviewers
7. Clicks "Request Review"
8. System:
   - Sends notification to reviewers
   - Creates code review task
   - Updates task status to "In Review"
   - Notifies manager (for tracking)
9. Reviewers receive: "Sarah asked you to review: payment validation"

**Postcondition:** Code review requested and assigned

---

## Viewer Use Cases

### UC-13: Monitor Product Status

**Actor:** Viewer/Client  
**Precondition:** Viewer has access to product (read-only)

**Main Flow:**
1. Viewer navigates to product dashboard
2. Can see (read-only):
   - Product overview
   - Project list with status
   - Completion percentages
   - High-level timeline
   - Public announcements
3. Viewer cannot see:
   - Detailed task list
   - Team member details
   - Time tracking data
   - Cost information
   - Internal comments
4. Viewer clicks on a project: "Phase 1: Core Features"
5. Sees:
   - Project description
   - Expected completion date
   - Completion percentage: 85%
   - Public status: "On Track"
6. Viewer leaves comment: "Looks great! Very excited for launch"
7. Clicks "Watch Project" to get updates

**Postcondition:** Viewer monitoring product progress

---

## Cross-Role Use Cases

### UC-14: Complete Team Workflow - Feature Development

**Scenario:** Team developing new payment gateway feature

**Step 1: Kickoff (Product Manager)**
```
1. PM creates project: "Payment Gateway Integration"
2. Adds description and success criteria
3. Adds 5 developers: Senior Dev (Lead), 3 Developers, 1 QA
4. Sends invite emails to all
```

**Step 2: Team Onboarding (Developers)**
```
1. Developers receive invites
2. Accept and view project
3. See pre-created tasks:
   - "Setup development environment"
   - "Design database schema"
   - "Implement payment API"
   - "Create integration tests"
4. Senior Dev assigns tasks to team
```

**Step 3: Development Cycle (Developers)**
```
Daily for 2 weeks:
- Developers log in
- Check assigned tasks
- Update status as work progresses
- Log time entries
- Leave comments on task
- Review code of teammates
```

**Step 4: Time Tracking (Developers)**
```
End of each day:
- Log time spent on tasks
- Track billable hours
- Estimate remaining time
```

**Step 5: Weekly Approval (Manager)**
```
Friday EOD:
1. All developers submit timesheets
2. Manager reviews in bulk view
3. Approves all timesheets
4. Sends summary to finance
5. Total cost for week: $12,000 (120 hours × $100/hr)
```

**Step 6: Project Completion (PM)**
```
After 2 weeks:
1. All tasks marked complete
2. PM reviews completed project
3. Runs acceptance tests
4. Marks project as "Complete"
5. Generates project report
6. Archives project
```

**Step 7: Analytics Review (Admin)**
```
1. Admin views product analytics
2. Sees project statistics:
   - Total time: 120 hours
   - Total cost: $12,000
   - Cycle time: 2 weeks
   - Team utilization: 95%
3. Exports report for stakeholders
```

---

### UC-15: Multi-Team Collaboration

**Scenario:** Two teams working on dependent projects

**Team A: Backend (Payment Service)**
- Working on: "Payment Processing API"
- Milestone: "API Ready for Integration" (Apr 15)

**Team B: Frontend (Payment UI)**
- Blocked: Waiting for Team A's API
- Planned milestone: "UI Complete" (Apr 22)

**Workflow:**

1. **Week 1: Team A Progresses**
   - Team A: 60% complete on API
   - Frontend: Starts mockup work (not blocked)

2. **Week 2: Dependency Risk**
   - Team A: 80% complete (on track)
   - Team B lead: Contacts Team A PM
   - Request: "Can we get API spec to start integration?"

3. **Team A Unblocks Team B**
   - Team A PM shares API documentation
   - Team B starts integration work with mocks
   - Reduces blocking time

4. **Week 3: Integration**
   - Team A: Completes API (Apr 15) ✓
   - Team B: Begins real integration
   - Testing across both teams

5. **Week 4: Testing & Refinement**
   - Both teams collaborate on bugs
   - Cross-team code reviews
   - Final integration testing

6. **Final: Project Completion**
   - Full feature delivered on time
   - Both teams contributed: 240 hours total
   - Total cost: $24,000

---

### UC-16: Real-Time Notifications

**Scenario:** Team member gets notified of changes

**Setup:** Developer has enabled notifications

**Flow:**

```
9:00 AM - Project Manager creates task
         → Developer's browser shows toast: "New task assigned: Payment Validation"

10:00 AM - Another developer comments on shared task
          → Developer gets desktop notification (if enabled)

11:00 AM - Manager approves timesheet
          → Developer receives notification: "Your timesheet approved, cost: $400"

2:00 PM - Code review assigned
         → Senior developer gets notification: "Sarah requests your code review"

3:00 PM - Team member added to project
         → New member gets welcome notification with onboarding info
```

---

## Use Case Matrix

| Use Case | Admin | PM | Dev | Viewer |
|----------|-------|-----|-----|--------|
| Create Product | ✅ | ❌ | ❌ | ❌ |
| Manage Permissions | ✅ | ❌ | ❌ | ❌ |
| Archive/Delete Product | ✅ | ❌ | ❌ | ❌ |
| View Audit Logs | ✅ | ⚠️* | ❌ | ❌ |
| Create Linked Project | ✅ | ✅ | ❌ | ❌ |
| Update Product Info | ✅ | ✅ | ❌ | ❌ |
| Add Team Member | ✅ | ✅ | ❌ | ❌ |
| Track Progress | ✅ | ✅ | ⚠️** | ❌ |
| View Assigned Tasks | ✅ | ✅ | ✅ | ❌ |
| Log Time | ✅ | ✅ | ✅ | ❌ |
| Submit Timesheet | ✅ | ✅ | ✅ | ❌ |
| Request Code Review | ✅ | ✅ | ✅ | ❌ |
| Monitor Status | ✅ | ✅ | ✅ | ✅ |

*Limited to own products  
**Limited to assigned work

---

**End of Product Use Cases**
