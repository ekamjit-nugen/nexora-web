# Time Tracking Feature - Complete Workflow

**Feature:** Time Tracking & Timesheet Management  
**Version:** 1.0.0  
**Last Updated:** March 31, 2026

---

## Overview

The Time Tracking workflow covers how team members log time, manage timesheets, and how managers approve time entries. Includes billable hour tracking, cost calculations, and integrations with payroll.

---

## Core Workflow: Daily Time Tracking

### Phase 1: Developer Starts Work

```
Developer Logs In
  ↓
Dashboard shows:
  - Today's tasks
  - Active timer (if in progress)
  - Time logged today: 0 hours
  ↓
Developer clicks on task: "Implement payment validation"
  ↓
Task detail panel opens
  ├─ Task status: Todo
  ├─ Assigned to: Self
  ├─ Due: 2026-04-02
  ├─ Time logged: 0 hours
  ├─ Estimate: 5 hours
  └─ [Start Work] button
```

### Phase 2: Start Work Timer

```
Developer clicks "Start Work"
  ↓
┌─────────────────────────────────────────┐
│ Task Status Changed                     │
│ ✓ Status: Todo → In Progress            │
│ ✓ Timer started: 10:00 AM               │
│ ✓ Browser tab shows: "⏱️ Time Tracker" │
│ ✓ Notification: "You started working"   │
└─────────────────────────────────────────┘
  ↓
Timer runs in background:
  ├─ Visible in:
  │   ├─ Task detail panel
  │   ├─ Top navigation bar
  │   └─ Browser tab title
  │
  └─ Running display: "⏱️ 0:15:42"
```

### Phase 3: Developer Works

```
Developer works for 2 hours
  ↓
Timer shows: 2:00:15
  ↓
Developer pauses timer (lunch break)
  └─ Click pause icon
  └─ Timer pauses at 2:00:15
  └─ Status: "Paused"
```

### Phase 4: Resume & Complete

```
Developer returns from lunch
  ↓
Clicks resume on timer
  └─ Timer resumes from 2:00:15
  ↓
Developer works another 3 hours
  ├─ Total time: 5:00:30
  ├─ Task 95% complete
  └─ Comments: "Ready for code review"
  ↓
Developer clicks "Complete Work"
  ↓
┌─────────────────────────────────────────┐
│ Log Time Entry                          │
├─────────────────────────────────────────┤
│ Duration: 5 hours 0 minutes             │
│ (Rounded from 5:00:30)                  │
│                                         │
│ Additional Options:                     │
│ Date: [2026-03-31] (today)              │
│ Description: [Auto-filled: "Implement   │
│  payment validation"]                   │
│ Billable: [✓ Yes]                       │
│ Rate: [$100/hour]                       │
│ Cost: $500                              │
│                                         │
│ Task Status: [In Progress → In Review]  │
│ [Log Time] [Save & Continue Working]    │
└─────────────────────────────────────────┘
  ↓
Developer clicks "Log Time"
  ↓
┌─────────────────────────────────────────┐
│ ✓ Time Logged Successfully              │
│                                         │
│ Summary:                                │
│ - Duration: 5 hours                     │
│ - Cost: $500                            │
│ - Added to timesheet                    │
│ - Task status updated                   │
│ - Manager notified                      │
│                                         │
│ Daily Total: 5.0 hours ($500)           │
│ Weekly Total: 5.0 hours ($500)          │
│ [View Timesheet] [View Details]         │
└─────────────────────────────────────────┘
```

---

## Complete Timesheet Workflow

### Phase 1: Monday - Wednesday (Daily Logging)

```
Monday (Mar 31):
  ├─ 10:00 AM: Log 4 hours - Payment validation
  ├─ 2:00 PM:  Log 3 hours - API integration (lunch break 12-1 PM)
  └─ Total: 7 hours ($700)
  
Tuesday (Apr 1):
  ├─ 9:00 AM:  Log 8 hours - Payment validation + testing
  └─ Total: 8 hours ($800)

Wednesday (Apr 2):
  ├─ 9:00 AM:  Log 4 hours - Code review of teammates
  ├─ 1:00 PM:  Log 3 hours - Fix review comments
  └─ Total: 7 hours ($700)

Running Total: 22 hours ($2,200)
```

### Phase 2: Thursday-Friday (Continuation)

```
Thursday (Apr 3):
  ├─ 9:00 AM:  Log 8 hours - Complete payment feature
  └─ Total: 8 hours ($800)

Friday (Apr 4):
  ├─ 9:00 AM:  Log 3 hours - Final testing
  ├─ 12:00 PM: Company meeting (0 hours logged)
  ├─ 2:00 PM:  Blocked: Waiting for QA feedback (0 hours)
  └─ Total: 3 hours ($300)

Week Total: 40 hours ($4,000)
```

### Phase 3: View Weekly Timesheet

```
Friday EOD: Developer clicks "Timesheets"
  ↓
┌─────────────────────────────────────────┐
│ Weekly Timesheet - Mar 31 - Apr 6, 2026 │
│ Status: DRAFT (not submitted yet)       │
├─────────────────────────────────────────┤
│ Mon (Mar 31): 7.0h  ($700)  ✓ Complete │
│ Tue (Apr 1):  8.0h  ($800)  ✓ Complete │
│ Wed (Apr 2):  7.0h  ($700)  ✓ Complete │
│ Thu (Apr 3):  8.0h  ($800)  ✓ Complete │
│ Fri (Apr 4):  3.0h  ($300)  ⚠️ Partial │
│ ─────────────────────────────────────  │
│ TOTAL:       33.0h  ($3,300)            │
│                                         │
│ Fri incomplete? [Add Entry]             │
│ Next: Friday (7.0h needed for 40h week)│
└─────────────────────────────────────────┘
  ↓
Developer logs additional time Friday
  └─ 7 more hours on other tasks
  └─ Weekly total now: 40 hours
```

### Phase 4: Daily Timesheet Review

```
Manager (Jane Smith) views timesheet
  ↓
Jane's Dashboard shows:
  "Pending Timesheets: 5 to approve"
  ↓
Jane clicks "Review Timesheets"
  ↓
┌─────────────────────────────────────────┐
│ Team Timesheets - Week Mar 31-Apr 6    │
├─────────────────────────────────────────┤
│ ☑ Sarah Chen   - 40.0h  ($4,000) ✓     │
│ ☑ John Doe     - 40.0h  ($3,800) ✓     │
│ ☑ Mike Johnson - 38.5h  ($3,850) ⚠️   │
│ ☑ Lisa Park    - 40.0h  ($4,200) ✓     │
│ ☑ Alex Kumar   - 35.0h  ($3,500) ⚠️   │
│                                         │
│ ☐ Mike: Missing 1.5h (explain?)        │
│ ☐ Alex: Missing 5h (explain?)          │
│                                         │
│ Total (4 approved): $15,800             │
│ Pending: 2 timesheets ($7,550)          │
│ [Approve All] [Select to Review]        │
└─────────────────────────────────────────┘
```

### Phase 5: Manager Reviews Individual Entry

```
Jane clicks on Mike Johnson's timesheet
  ↓
┌─────────────────────────────────────────┐
│ Mike Johnson - Weekly Timesheet         │
│ Week: Mar 31 - Apr 6, 2026              │
│ Status: SUBMITTED (pending approval)    │
├─────────────────────────────────────────┤
│ Daily Breakdown:                        │
│ Mon: 8.0h  ✓ Complete                   │
│ Tue: 8.0h  ✓ Complete                   │
│ Wed: 8.0h  ✓ Complete                   │
│ Thu: 8.0h  ✓ Complete                   │
│ Fri: 6.5h  ⚠️ Below 8h                  │
│ ─────────────────────────────────────  │
│ TOTAL: 38.5h (2.5h below target)        │
│                                         │
│ Tasks Completed:                        │
│ - Payment validation: 18h               │
│ - API integration: 12h                  │
│ - Code review: 8.5h                     │
│                                         │
│ Notes from Mike: "Fri short - sick"     │
│                                         │
│ [Approve] [Request Changes] [Reject]    │
└─────────────────────────────────────────┘
  ↓
Jane clicks "Approve"
  (Trusts Mike's sick leave note)
  ↓
Timesheet approved
  ├─ Status: Approved
  ├─ Mike notified
  └─ Cost finalized: $3,850
```

### Phase 6: Submit Timesheet

```
Friday 5 PM: All developers have submitted timesheets
  ↓
┌─────────────────────────────────────────┐
│ Submit Timesheet                        │
├─────────────────────────────────────────┤
│ Week: Mar 31 - Apr 6, 2026              │
│ Total Hours: 40.0                       │
│ Total Billable Cost: $4,000             │
│                                         │
│ Tasks Breakdown:                        │
│ Payment Validation: 20h ($2,000)        │
│ API Integration:    15h ($1,500)        │
│ Code Review:        5h  ($500)          │
│                                         │
│ Manager: Jane Smith                     │
│ Note: "All set for approval"            │
│                                         │
│ ⚠️ WARNING:                             │
│ Once submitted, you cannot edit         │
│ unless manager rejects.                 │
│                                         │
│ [Submit for Approval]                   │
└─────────────────────────────────────────┘
  ↓
Developer clicks "Submit for Approval"
  ↓
Timesheet locked (no further edits)
  ├─ Status: Submitted
  ├─ Awaiting: Manager approval
  └─ Manager notified via email
```

### Phase 7: Manager Approval Workflow

```
Monday 9 AM: Jane (Manager) reviews team timesheets
  ↓
Notification: "5 team members submitted timesheets"
  ↓
Jane opens "Timesheets" → "Pending Approval"
  ↓
┌─────────────────────────────────────────┐
│ Pending Approvals                       │
├─────────────────────────────────────────┤
│ 1. Sarah Chen   - 40.0h ($4,000)        │
│ 2. John Doe     - 40.0h ($3,800)        │
│ 3. Mike Johnson - 38.5h ($3,850)        │
│ 4. Lisa Park    - 40.0h ($4,200)        │
│ 5. Alex Kumar   - 35.0h ($3,500)        │
│                                         │
│ Total (if approved): $19,350            │
│                                         │
│ [Approve All] [Review Individually]     │
└─────────────────────────────────────────┘
  ↓
Jane reviews each one (2 minutes per timesheet)
  ↓
All look good except Alex (below hours)
  ↓
┌─────────────────────────────────────────┐
│ Alex Kumar - Request Changes            │
├─────────────────────────────────────────┤
│ Current: 35.0h (5h below target)        │
│                                         │
│ Message to Alex:                        │
│ "Please log remaining 5 hours or        │
│  explain the shortfall"                 │
│                                         │
│ [Send Request]                          │
└─────────────────────────────────────────┘
  ↓
Jane approves 4 timesheets
  ├─ Status: Approved
  ├─ Cost locked: $16,850
  └─ Developers notified
```

### Phase 8: Employee Revises & Resubmits

```
Alex receives notification:
  "Your timesheet needs revision"
  ↓
Alex clicks notification
  ↓
Timesheet reopened for editing
  ├─ Status: Rejected / In Revision
  ├─ Jane's message visible
  └─ Timer shows: "5h missing"
  ↓
Alex adds entries:
  - Tuesday PM: 2h (didn't log it before)
  - Wednesday: 3h (worked late, forgot)
  ↓
New total: 40.0h ($4,000)
  ↓
Alex resubmits
  └─ Status: Resubmitted to Jane
  ↓
Jane approves revised timesheet
  ├─ Status: Approved
  ├─ Cost finalized: $4,000
  └─ Alex notified
```

---

## Billing & Payment Integration

### Phase 1: Week End - Costs Summary

```
Friday 6 PM: Finance checks cost summary
  ↓
All timesheets approved
  ├─ Sarah: $4,000 (40h @ $100/h)
  ├─ John:  $3,800 (40h @ $95/h)
  ├─ Mike:  $3,850 (38.5h @ $100/h)
  ├─ Lisa:  $4,200 (40h @ $105/h)
  └─ Alex:  $4,000 (40h @ $100/h)
  ↓
Weekly Total: $19,850
Monthly (4 weeks): ~$79,400
```

### Phase 2: Billing by Project

```
Finance team generates "Billing by Project"
  ↓
Payment Gateway Project:
  ├─ Sarah: 25h ($2,500)
  ├─ John:  30h ($2,850)
  └─ Subtotal: $5,350 (25% of project budget)
  ↓
Mobile App Project:
  ├─ Mike:  30h ($3,000)
  ├─ Lisa:  32h ($3,360)
  └─ Subtotal: $6,360 (35% of project budget)
  ↓
General/Overhead:
  └─ Alex:  40h ($4,000)
  └─ Subtotal: $4,000
```

### Phase 3: Invoice Generation

```
End of month: Accounting generates invoices
  ↓
For each client project:
  1. Sum all developer hours
  2. Apply rates (standard or custom)
  3. Calculate billable amount
  4. Generate invoice
  5. Send to client
  ↓
Example Invoice:
  Client: TechCorp Inc.
  Period: March 2026
  
  Project: Payment Gateway
  - Development: 25h @ $100/h = $2,500
  - QA Testing:  5h @ $80/h = $400
  - Code Review: 2h @ $100/h = $200
  
  Total: $3,100
  
  [Generate PDF] [Send to Client] [Record in Accounting]
```

---

## Error Scenarios & Handling

### Scenario 1: Forgot to Log Time

```
Friday EOD: Developer realizes 8 hours weren't logged
  ↓
Clicks "Add Time Entry" (manual entry)
  ↓
┌─────────────────────────────────────────┐
│ Manual Time Entry                       │
├─────────────────────────────────────────┤
│ Date: [Apr 1] (retroactive)             │
│ Duration: [8 hours]                     │
│ Task: [Payment Integration]             │
│ Description: "Forgot to log yesterday"  │
│ Billable: [✓]                           │
│ [Save Entry]                            │
└─────────────────────────────────────────┘
  ↓
Entry created
  ├─ Timestamp: Now
  ├─ Entry date: Yesterday
  ├─ Approval required from manager
  └─ Manager notified
```

### Scenario 2: Overlapping Time Entries

```
Developer has overlapping entries:
  - Task A: 2:00 PM - 4:00 PM (logged)
  - Task B: 3:00 PM - 5:00 PM (logged)
  ↓
System detects overlap (1 hour)
  ↓
Warning: "These entries overlap by 1 hour"
  ├─ Task A: 2:00-4:00 PM
  ├─ Task B: 3:00-5:00 PM
  └─ Conflicting: 3:00-4:00 PM
  ↓
Options:
  1. Adjust one entry (move start/end time)
  2. Mark as "not billable" (personal time)
  3. Accept overlap (document why)
  ↓
Developer adjusts Task B: 4:00 PM - 6:00 PM
  └─ Overlap resolved
```

### Scenario 3: Manager Rejects Timesheet

```
Mike's timesheet has issue:
  - Friday shows 10 hours (unusual, needs approval)
  - No explanation provided
  ↓
Jane (manager) rejects:
  "Friday entry needs explanation. 
   10 hours seems high. Confirm or adjust."
  ↓
Mike's timesheet reopened
  ├─ Status: Rejected
  ├─ Reason visible to Mike
  └─ Can edit
  ↓
Mike adds note:
  "Friday: 6h regular + 4h overtime (client emergency)"
  ↓
Resubmits
  ↓
Jane approves with note:
  "Thanks for clarification. Approved with overtime."
```

---

## Role-Based Time Tracking Access

| Action | Dev | Manager | Admin | Finance |
|--------|-----|---------|-------|---------|
| Log own time | ✅ | ✅ | ✅ | ❌ |
| Log others' time | ❌ | ✅ | ✅ | ❌ |
| View own timesheet | ✅ | ✅ | ✅ | ✅ |
| View team timesheet | ❌ | ✅ | ✅ | ✅ |
| Approve own | ❌ | ✅ | ✅ | ❌ |
| Approve others' | ❌ | ✅ | ✅ | ❌ |
| View costs | ❌ | ⚠️* | ✅ | ✅ |
| Export billing | ❌ | ❌ | ✅ | ✅ |

*Manager sees team costs only

---

**End of Time Tracking Workflow**
