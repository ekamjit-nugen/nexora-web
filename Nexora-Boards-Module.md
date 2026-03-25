# Nexora — Boards Module: Complete Feature Reference

> **Version:** 2.0  
> **Platform:** Nexora by Nugen IT Services  
> **Stack:** React.js · Node.js · MongoDB · Tailwind CSS  
> **Last Updated:** March 2026  
> **Depends On:** Projects Module, Tasks Module

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Board Data Model](#2-board-data-model)
3. [Column Management](#3-column-management)
4. [Swimlanes](#4-swimlanes)
5. [Card Layout & Rendering](#5-card-layout--rendering)
6. [Board Filters & Search](#6-board-filters--search)
7. [Drag & Drop Engine](#7-drag--drop-engine)
8. [Task Detail Drawer](#8-task-detail-drawer)
9. [Board Views](#9-board-views)
10. [Board-Level Permissions](#10-board-level-permissions)
11. [Board Analytics](#11-board-analytics)
12. [Board Templates — Overview](#12-board-templates--overview)
13. [Template 1 — Scrum Sprint Board](#13-template-1--scrum-sprint-board)
14. [Template 2 — Standard Kanban](#14-template-2--standard-kanban)
15. [Template 3 — Bug Tracker Board](#15-template-3--bug-tracker-board)
16. [Template 4 — DevOps Pipeline Board](#16-template-4--devops-pipeline-board)
17. [Template 5 — Release Management Board](#17-template-5--release-management-board)
18. [Template 6 — Support & Service Desk Board](#18-template-6--support--service-desk-board)
19. [Template 7 — Design Sprint Board](#19-template-7--design-sprint-board)
20. [Template 8 — Content & Marketing Board](#20-template-8--content--marketing-board)
21. [Template 9 — Client Onboarding Board](#21-template-9--client-onboarding-board)
22. [Template 10 — Recruitment Pipeline Board](#22-template-10--recruitment-pipeline-board)
23. [Template 11 — Eisenhower Priority Matrix](#23-template-11--eisenhower-priority-matrix)
24. [Template 12 — Approval Workflow Board](#24-template-12--approval-workflow-board)
25. [Template Application Engine](#25-template-application-engine)
26. [Save Board as Template](#26-save-board-as-template)
27. [Board ↔ Project Integration](#27-board--project-integration)
28. [Board ↔ Team Integration](#28-board--team-integration)
29. [Board ↔ Sprint Integration](#29-board--sprint-integration)
30. [Board Automations](#30-board-automations)
31. [API Endpoints](#31-api-endpoints)
32. [Database Schema](#32-database-schema)
33. [Frontend Pages & Components](#33-frontend-pages--components)
34. [Keyboard Shortcuts & Accessibility](#34-keyboard-shortcuts--accessibility)

---

## 1. Overview & Architecture

### 1.1 What Is a Board?

A Board is a visual workspace within a project that organizes tasks into columns representing workflow stages. Every board belongs to exactly one project and inherits the project's team, statuses, labels, and custom fields.

### 1.2 Relationship Hierarchy

```
Organization
└── Project
    ├── Board A (Sprint Board — scrum)
    │   ├── Column: To Do
    │   │   ├── Task WEB-001
    │   │   └── Task WEB-005
    │   ├── Column: In Dev (WIP: 3)
    │   │   └── Task WEB-003
    │   ├── Column: Code Review (WIP: 2)
    │   └── Column: Done
    │
    ├── Board B (Backlog Board — kanban)
    │   ├── Column: Icebox
    │   ├── Column: Groomed
    │   └── Column: Sprint Ready
    │
    └── Board C (Bug Tracker — bug_tracker)
        ├── Column: New
        ├── Column: Triaged
        ├── Column: Fixing
        └── Column: Verified
```

### 1.3 Key Design Rules

- A project can have **unlimited boards** (recommended: 1-5)
- Every project must have **at least one board** (auto-created on project creation)
- The first board created in a project is marked as the **default board**
- A task belongs to **one board at a time** but can be moved between boards within the same project
- Each board column maps to one or more **project-level statuses** — when a task moves to a column, its status auto-updates
- Board columns do NOT define new statuses — they reference the project's status configuration
- Boards inherit the project's **team** — board-level permissions add a layer of who can do what on this specific board

---

## 2. Board Data Model

### 2.1 Core Fields

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| name | string | Yes | — | Max 100 chars. Display name. |
| description | string | No | — | Max 500 chars. Shown below board name. |
| projectId | ObjectId | Yes | — | ref: Project. Parent project. |
| organizationId | ObjectId | — | JWT org | Multi-tenant isolation. |
| type | enum | Yes | kanban | `scrum`, `kanban`, `bug_tracker`, `custom` |
| columns | array | — | [] | Ordered column definitions (see Section 3). |
| swimlaneConfig | object | No | `{ enabled: false }` | Swimlane configuration (see Section 4). |
| cardLayout | object | — | default | What fields to show on task cards (see Section 5). |
| filterConfig | object | No | {} | Saved default filter for this board. |
| quickFilters | string[] | No | [] | Field keys shown in quick-filter bar. |
| isDefault | boolean | — | false | First board in a project = true. |
| isFavorite | boolean | — | false | Per-user favorite (stored separately, not on board doc). |
| isArchived | boolean | — | false | Archived boards are hidden from the board list but retain data. |
| isDeleted | boolean | — | false | Soft-delete. |
| color | string | No | — | Board accent color (used in board list/tabs). |
| icon | string | No | layout-kanban | Lucide icon name. |
| templateRef | ObjectId | No | — | ref: BoardTemplate. Which template created this board. |
| createdBy | ObjectId | — | JWT user | ref: User. |
| createdAt | date | — | auto | |
| updatedAt | date | — | auto | |

### 2.2 Board Type Behaviors

| Behavior | Scrum | Kanban | Bug Tracker | Custom |
|---|---|---|---|---|
| Sprint controls visible | Yes | No | No | No |
| Sprint selector dropdown | Yes | No | No | No |
| Velocity metrics | Yes | No | No | No |
| Burndown chart | Yes | No | No | No |
| WIP limits enforced | Optional | Yes (default) | Optional | Optional |
| Cycle time tracking | Yes | Yes | Yes | No |
| Default swimlane | By Assignee | None | By Priority | None |
| Card shows story points | Yes | Optional | No | Optional |
| Card shows severity | No | No | Yes | Optional |

---

## 3. Column Management

### 3.1 Column Schema

```javascript
columns: [{
  id:             String,       // UUID, auto-generated
  name:           String,       // display name, max 50 chars
  key:            String,       // slugified, unique per board
  order:          Number,       // 0-indexed position (left to right)
  statusMapping:  [String],     // project status keys mapped to this column
  color:          String,       // hex color for column header
  wipLimit:       Number,       // 0 = unlimited. Max tasks allowed. Enforced on drag.
  isCollapsed:    Boolean,      // UI state — collapsed shows only count
  isDoneColumn:   Boolean,      // tasks here count as complete for board metrics
  isStartColumn:  Boolean,      // first "work" column — cycle time starts here
  autoAssignRule: {             // optional: auto-assign when task enters this column
    type:  String,              // 'none' | 'column-owner' | 'round-robin' | 'least-loaded'
    userId: ObjectId            // for 'column-owner' type
  },
  columnOwnerId:  ObjectId,     // optional: team member responsible for this column
  taskCount:      Number        // denormalized count, updated on task move (virtual in read)
}]
```

### 3.2 Status-to-Column Mapping

This is the core bridge between the project's workflow and the board's visual layout.

**Rules:**
- Every column maps to one or more project statuses via `statusMapping[]`
- When a task is dragged to a column, its status is set to `statusMapping[0]` (first mapped status)
- Multiple columns can map to the same status (e.g., two "In Progress" sub-columns)
- When a task's status is changed via API (not drag), it appears in the first column that maps to that status
- A column with empty `statusMapping` acts as a visual-only bucket (tasks in it retain their existing status)

**Example — Scrum Sprint Board:**

```
Column: "To Do"          → statusMapping: ['todo']
Column: "In Development" → statusMapping: ['in_dev']
Column: "Code Review"    → statusMapping: ['code_review']
Column: "QA Testing"     → statusMapping: ['qa_testing']
Column: "Done"           → statusMapping: ['done']
```

**Example — Bug Tracker (multiple statuses per column):**

```
Column: "Open"           → statusMapping: ['new', 'triaged']
Column: "Working"        → statusMapping: ['investigating', 'fix_in_progress']
Column: "Verify"         → statusMapping: ['fixed']
Column: "Closed"         → statusMapping: ['verified', 'closed', 'wont_fix']
```

### 3.3 Predefined Column Colors (12)

| Name | Hex | Usage |
|---|---|---|
| Slate | #94A3B8 | Backlog, Icebox, Not Started |
| Blue | #3B82F6 | To Do, Open, Active |
| Amber | #F59E0B | In Progress, Working |
| Violet | #8B5CF6 | Review, In Review |
| Emerald | #10B981 | Done, Verified, Closed |
| Red | #EF4444 | Blocked, Rejected, Failed |
| Pink | #EC4899 | Design, Creative |
| Cyan | #06B6D4 | Testing, QA |
| Orange | #F97316 | Escalated, Urgent |
| Indigo | #6366F1 | Staging, Pre-Release |
| Lime | #84CC16 | Approved, Ready |
| Rose | #F43F5E | Cancelled, Won't Fix |

### 3.4 Column Operations

| Operation | Endpoint | Notes |
|---|---|---|
| Add column | `POST /boards/:id/columns` | Body: `{ name, color, wipLimit, statusMapping, afterColumnId? }`. Position: end of list, or after `afterColumnId`. |
| Update column | `PUT /boards/:id/columns/:colId` | Updatable: name, color, wipLimit, statusMapping, isCollapsed, autoAssignRule, columnOwnerId. |
| Delete column | `DELETE /boards/:id/columns/:colId` | Cannot delete last column. All tasks in deleted column move to the first remaining column. Returns 409 if column has tasks and `force=false`. |
| Reorder columns | `PUT /boards/:id/columns/reorder` | Body: `{ columnIds: ['col_3','col_1','col_2'] }`. Full ordered array required. |
| Collapse/Expand | `PATCH /boards/:id/columns/:colId/collapse` | Toggle `isCollapsed`. |

### 3.5 WIP Limit Enforcement

When `wipLimit > 0`:
- **Drag-and-drop**: Drop is rejected if target column's task count >= wipLimit. UI shows red flash on column header + toast notification.
- **API status change**: Returns `409 Conflict` with message: `"Column '{name}' has reached its WIP limit of {wipLimit}."`
- **Visual indicators**: Column header shows `{current}/{wipLimit}` badge. Badge turns amber at 80%, red at 100%.
- **Override**: Project admins and managers can override WIP limits via a "Force Move" option (logged as activity).
- **Automation trigger**: `board.wip_exceeded` event fires when limit is breached via override.

---

## 4. Swimlanes

### 4.1 Swimlane Configuration

```javascript
swimlaneConfig: {
  enabled:    Boolean,        // master toggle
  groupBy:    String,         // field to group by (see options below)
  fieldKey:   String,         // for 'custom_field' groupBy, which custom field
  showEmpty:  Boolean,        // show swimlanes with 0 tasks (default: false)
  collapsed:  [String],       // list of swimlane keys currently collapsed
  sortOrder:  String,         // 'default' | 'asc' | 'desc' | 'count-desc' | 'count-asc'
  defaultLane: String         // label for tasks that don't match any lane (e.g., "Unassigned")
}
```

### 4.2 Swimlane Group-By Options

| groupBy Value | Lanes Created | Lane Key | Lane Label |
|---|---|---|---|
| `assignee` | One lane per assigned team member + "Unassigned" | userId or `_unassigned` | User display name |
| `priority` | One lane per priority level | priority enum value | "Critical", "High", "Medium", "Low" |
| `type` | One lane per task type | type enum value | "Epic", "Story", "Task", "Bug", etc. |
| `label` | One lane per label on the board's project | label key | Label name |
| `epic` | One lane per epic task in the project | epic taskId | Epic title |
| `sprint` | One per sprint + "No Sprint" | sprintId or `_none` | Sprint name |
| `custom_field` | One lane per option value of specified custom field | option value | Option label |
| `status_category` | Groups by status category | category key | "To Do", "In Progress", "Blocked", "Done" |

### 4.3 Swimlane Rendering

```
┌─────────────────────────────────────────────────────────────┐
│  Swimlane: Aman S. (Tech Lead)                     [▼ 8]    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ To Do    │  │ In Dev   │  │ Review   │  │ Done     │   │
│  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │   │
│  │ │WEB-12│ │  │ │WEB-05│ │  │ │WEB-03│ │  │ │WEB-01│ │   │
│  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │   │
│  │ ┌──────┐ │  │ ┌──────┐ │  │          │  │          │   │
│  │ │WEB-14│ │  │ │WEB-08│ │  │          │  │          │   │
│  │ └──────┘ │  │ └──────┘ │  │          │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Swimlane: Karan J. (Frontend Developer)           [▼ 5]    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ To Do    │  │ In Dev   │  │ Review   │  │ Done     │   │
│  │ ┌──────┐ │  │ ┌──────┐ │  │          │  │ ┌──────┐ │   │
│  │ │WEB-18│ │  │ │WEB-10│ │  │          │  │ │WEB-07│ │   │
│  │ └──────┘ │  │ └──────┘ │  │          │  │ └──────┘ │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Swimlane: Unassigned                              [▼ 3]    │
│  ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

**Swimlane Header:**
- Lane label (e.g., user name, priority, epic name)
- Task count badge
- Collapse/expand toggle
- For `assignee` swimlane: avatar, role badge, allocation % if available from project team

**Cross-Swimlane Drag:**
- Dragging a task from one swimlane to another updates the grouping field (e.g., dragging between assignee lanes reassigns the task)
- Dragging between columns within a lane updates the task status
- Diagonal drag (different lane + different column) updates both

---

## 5. Card Layout & Rendering

### 5.1 Card Layout Configuration

Each board defines what fields appear on task cards:

```javascript
cardLayout: {
  showTaskKey:     Boolean,    // default: true — "WEB-042"
  showAvatar:      Boolean,    // default: true — assignee avatar
  showPriority:    Boolean,    // default: true — priority dot/icon
  showLabels:      Boolean,    // default: true — label chips
  showEstimate:    Boolean,    // default: true — story points or hours badge
  showDueDate:     Boolean,    // default: true — due date (red if overdue)
  showSubtasks:    Boolean,    // default: true — "3/5" subtask counter
  showProgress:    Boolean,    // default: false — progress bar
  showCommentCount: Boolean,   // default: true — comment icon + count
  showAttachmentCount: Boolean,// default: false — paperclip icon + count
  showTypeIndicator: Boolean,  // default: true — colored left border
  showChecklistProgress: Boolean, // default: false — checklist completion bar
  customFields:    [String],   // custom field keys to show on card face
  compactMode:     Boolean     // default: false — reduced height, fewer details
}
```

### 5.2 Card Anatomy

```
┌─────────────────────────────────────────┐
│ ▌ WEB-042                    ● Medium   │  ← Type border (left) + Task key + Priority dot
│                                         │
│ Implement user authentication flow      │  ← Title (max 2 lines, truncated)
│                                         │
│ ┌────────┐ ┌─────────┐ ┌──────┐       │  ← Labels (max 3 visible, +N overflow)
│ │ Feature│ │ Backend │ │ +2   │       │
│ └────────┘ └─────────┘ └──────┘       │
│                                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░ 60%  │  ← Progress bar (if subtasks exist)
│                                         │
│  ☑ 3/5    💬 4    📎 2      🏷 8 SP   │  ← Subtasks + Comments + Attachments + Estimate
│                                         │
│  📅 Mar 28           👤 AS             │  ← Due date + Assignee avatar
└─────────────────────────────────────────┘
```

### 5.3 Card Visual States

| State | Visual Treatment |
|---|---|
| Normal | Default card style |
| Overdue | Due date in red, subtle red left border or glow |
| Blocked | Red overlay tint, "Blocked" badge, blocked icon |
| Selected | Blue border, elevated shadow |
| Dragging | Card lifts with shadow, original position shows dashed placeholder |
| Flagged / Urgent | Pulsing red dot on priority indicator |
| Done | Muted colors, strikethrough title (in list view only, not board) |
| Hovering | Slight elevation, subtle shadow increase |

### 5.4 Card Context Menu (Right-Click)

| Action | Shortcut | Description |
|---|---|---|
| Open task | Enter | Open in detail drawer |
| Open in new tab | — | Open full task page |
| Assign to me | A | Assign task to current user |
| Change priority | P | Priority picker submenu |
| Change status | S | Status picker submenu |
| Add label | L | Label picker submenu |
| Set due date | D | Date picker |
| Move to board | M | Board picker submenu |
| Add to sprint | — | Sprint picker (scrum boards only) |
| Copy task key | C | Copy "WEB-042" to clipboard |
| Copy task link | — | Copy full URL to clipboard |
| Duplicate | — | Create copy of this task |
| Delete | — | Soft-delete with confirmation |

### 5.5 Compact Mode

When `compactMode: true`:
- Card height reduced by ~40%
- Only shows: task key, title (1 line), priority dot, assignee avatar
- Hides: labels, progress bar, subtask count, comments, due date, estimate
- Useful for boards with many tasks per column

---

## 6. Board Filters & Search

### 6.1 Quick Filter Bar

Always visible at the top of the board. Defined by `quickFilters[]` on the board.

```
┌──────────────────────────────────────────────────────────────────┐
│  🔍 [Search tasks...]  👤 [Assignee ▾]  ⚡ [Priority ▾]        │
│  📌 [Type ▾]  🏷 [Labels ▾]  📅 [Due ▾]  [Clear Filters] (3) │
└──────────────────────────────────────────────────────────────────┘
```

**Quick Filter Types:**

| Filter | Input Type | Behavior |
|---|---|---|
| Search | Text input | Filters cards by title and task key (debounced 300ms) |
| Assignee | Avatar chip multi-select | Shows team members. Click to toggle. Multiple = OR logic. |
| Priority | Dropdown multi-select | Critical, High, Medium, Low, Trivial |
| Type | Dropdown multi-select | Epic, Story, Task, Sub-task, Bug, Improvement, Spike |
| Labels | Dropdown multi-select | Project labels. Multiple = OR logic. |
| Due Date | Preset picker | Overdue, Due Today, Due This Week, Due This Month, No Due Date |
| Sprint | Dropdown | Active Sprint, Specific Sprint, No Sprint (scrum boards only) |
| Custom Field | Varies | Dropdown/toggle per custom field configured in quickFilters |

**Filter Behavior:**
- All filters are combinable (AND logic between different filters, OR within same filter)
- Active filter count shown as badge on "Clear Filters" button
- Filters persist per board per user session (stored in localStorage)
- Cards not matching filters are hidden (column shows filtered count: "3 of 12")
- Empty columns after filtering remain visible (not collapsed)

### 6.2 Advanced Filter Panel

Expandable panel below quick filters with additional options:

| Filter | Type | Description |
|---|---|---|
| Reporter | User picker | Who created the task |
| Created Date | Date range | Tasks created within range |
| Updated Date | Date range | Tasks last modified within range |
| Has Subtasks | Boolean toggle | Tasks that do / don't have children |
| Is Blocked | Boolean toggle | Tasks with "blocked" status |
| Has Attachments | Boolean toggle | Tasks with file attachments |
| Estimate Range | Number range | Story points or hours range |
| Custom Field | Per-field | Any project custom field value |
| Dependency | Toggle | Has blockers / Has dependencies |

### 6.3 Saved Filters

Users can save filter combinations as named presets on a board:

```javascript
savedFilters: [{
  id:       String,
  name:     String,       // "My Overdue Tasks", "Frontend Work"
  query:    Mixed,        // serialized filter state
  isShared: Boolean,      // visible to all project members
  createdBy: ObjectId
}]
```

Saved filters appear as clickable pills above the quick filter bar. Shared filters are visible to the whole team. `GET /boards/:id/filters` returns the list.

---

## 7. Drag & Drop Engine

### 7.1 Implementation

- HTML5 Drag and Drop API with custom React wrapper
- DataTransfer carries: `{ taskId, sourceColumnId, sourceBoardId, sourceSwimlanKey }`
- Drop zones: each column cell (intersected by swimlane if active) is a drop target
- Real-time visual feedback: dashed border on active drop zone, ghost card at cursor

### 7.2 Drag Scenarios

| Scenario | What Happens | API Call |
|---|---|---|
| Same column, reorder | Task position within column changes | `PATCH /boards/:id/tasks/reorder` |
| Different column, same swimlane | Status changes to target column's `statusMapping[0]` | `POST /boards/:id/tasks/move` |
| Different column, different swimlane | Status changes + grouping field changes (e.g., assignee) | `POST /boards/:id/tasks/move` |
| Cross-board drag (same project) | Task moves to different board + column | `POST /boards/:targetBoardId/tasks/move` with `sourceBoardId` |

### 7.3 Move Task API

`POST /boards/:boardId/tasks/move`

**Request:**
```json
{
  "taskId": "tsk_abc",
  "targetColumnId": "col_xyz",
  "targetPosition": 2,
  "targetSwimlanKey": "user_karan",
  "sourceBoardId": "brd_old",
  "forceWipOverride": false
}
```

**Response:**
```json
{
  "success": true,
  "task": {
    "id": "tsk_abc",
    "taskKey": "WEB-042",
    "status": "in_dev",
    "assigneeId": "user_karan",
    "boardId": "brd_new",
    "columnId": "col_xyz"
  },
  "statusChanged": true,
  "previousStatus": "todo",
  "assigneeChanged": true,
  "previousAssignee": null,
  "automationsTriggered": ["Auto-assign code reviewer"]
}
```

**Validation Order:**
1. Task exists and belongs to the same project
2. User has permission to move tasks on this board
3. Workflow transition is allowed (if transitions are defined on project)
4. Transition conditions met (e.g., required fields populated)
5. WIP limit not exceeded on target column (unless `forceWipOverride`)
6. If all pass → move task, update status, fire automations, log activity

### 7.4 Optimistic UI

- Card moves immediately on drop (optimistic update)
- If API returns error → card snaps back to original position with error toast
- Concurrent moves by multiple users handled via WebSocket events (see 7.5)

### 7.5 Real-Time Sync (WebSocket)

Board views subscribe to real-time events for the active board:

| Event | Payload | UI Action |
|---|---|---|
| `task.moved` | taskId, fromCol, toCol, newPosition | Animate card to new position |
| `task.created` | task object | Add card to correct column |
| `task.updated` | taskId, changed fields | Re-render card |
| `task.deleted` | taskId | Remove card with fade |
| `column.updated` | columnId, changes | Update column header |
| `column.reordered` | column order array | Re-arrange columns |
| `wip.exceeded` | columnId, count, limit | Flash column header red |

WebSocket channel: `board:{boardId}` — users subscribe when opening a board, unsubscribe when leaving.

---

## 8. Task Detail Drawer

Right-side panel (480px width) that opens when clicking a task card. Overlay on board view — board remains visible and interactive behind it (dimmed).

### 8.1 Drawer Layout

```
┌──────────────────────────────────────────────────┐
│  [← Back to Board]            [⋮ Actions]  [✕]   │
├──────────────────────────────────────────────────┤
│                                                   │
│  WEB-042                                          │  ← Task key
│  ┌──────────────────────────────────────────┐    │
│  │ Implement user authentication flow       │    │  ← Editable title
│  └──────────────────────────────────────────┘    │
│                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░ 60%       │  ← Progress bar
│                                                   │
│  ┌── PROPERTIES GRID ──────────────────────┐     │
│  │ Status:    [In Development ▾]           │     │
│  │ Assignee:  [👤 Aman S. ▾]              │     │
│  │ Reporter:  Varun K.                     │     │
│  │ Priority:  [● High ▾]                  │     │
│  │ Type:      [Story ▾]                   │     │
│  │ Board:     Sprint Board                 │     │
│  │ Sprint:    Sprint 3                     │     │
│  │ Due Date:  [📅 Mar 28, 2026]           │     │
│  │ Estimate:  [8 SP]                      │     │
│  │ Logged:    3.5h / 12h                  │     │
│  │ Labels:    [Feature] [Backend] [+]     │     │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  ┌── CUSTOM FIELDS ───────────────────────┐      │
│  │ Component:   [Backend ▾]               │      │
│  │ PR Link:     [https://github.com/...]  │      │
│  │ Environment: [Development ▾]           │      │
│  └────────────────────────────────────────┘      │
│                                                   │
│  ┌── DESCRIPTION ─────────────────────────┐      │
│  │ As a user, I want to securely log in   │      │
│  │ so that my data is protected.          │      │
│  │                                [Edit]  │      │
│  └────────────────────────────────────────┘      │
│                                                   │
│  ┌── ACCEPTANCE CRITERIA ─────────────────┐      │
│  │ ☑ Users can register with email        │      │
│  │ ☑ JWT tokens issued on login           │      │
│  │ ☐ Refresh token rotation               │      │
│  │ ☐ Password reset flow                  │      │
│  │ ☐ OAuth integration                    │      │
│  └────────────────────────────────────────┘      │
│                                                   │
│  ┌── CHECKLISTS ──────────────────────────┐      │
│  │ Auth Checklist                  4/6    │      │
│  │ ☑ Create auth endpoints               │      │
│  │ ☑ JWT middleware                       │      │
│  │ ☑ Login UI                            │      │
│  │ ☑ Register UI                         │      │
│  │ ☐ OAuth buttons                       │      │
│  │ ☐ Password reset page                 │      │
│  └────────────────────────────────────────┘      │
│                                                   │
│  ┌── SUBTASKS ────────────────────────────┐      │
│  │ ✅ WEB-043: Backend auth API     Done  │      │
│  │ ✅ WEB-044: JWT middleware       Done  │      │
│  │ 🔵 WEB-045: Login/Register UI   InDev │      │
│  │ ⚪ WEB-046: OAuth buttons       Todo  │      │
│  │ ⚪ WEB-047: QA test cases       Todo  │      │
│  │ [+ Add subtask]                        │      │
│  └────────────────────────────────────────┘      │
│                                                   │
│  ┌── DEPENDENCIES ────────────────────────┐      │
│  │ 🚫 Blocked by: WEB-030 (DB Schema)    │      │
│  │ ➡️ Blocks: WEB-055 (Dashboard)        │      │
│  │ 🔗 Relates to: WEB-038                │      │
│  │ [+ Add dependency]                     │      │
│  └────────────────────────────────────────┘      │
│                                                   │
│  ┌── ATTACHMENTS ─────────────────────────┐      │
│  │ 📄 auth-flow-diagram.pdf    2.3 MB    │      │
│  │ 🖼 login-mockup.png         450 KB    │      │
│  │ [+ Upload file]                        │      │
│  └────────────────────────────────────────┘      │
│                                                   │
│  ┌── TIME LOG ────────────────────────────┐      │
│  │ Mar 24 — Aman S. — 2h — Auth API      │      │
│  │ Mar 25 — Aman S. — 1.5h — JWT impl    │      │
│  │ [+ Log time]                           │      │
│  └────────────────────────────────────────┘      │
│                                                   │
│  ┌── COMMENTS ────────────────────────────┐      │
│  │ 💬 Varun — Mar 24, 10:30 AM           │      │
│  │ "Let's use httpOnly cookies for the    │      │
│  │ refresh token instead of localStorage" │      │
│  │                                        │      │
│  │ 💬 Aman — Mar 24, 11:15 AM            │      │
│  │ "@Varun agreed, I'll update the impl"  │      │
│  │                                        │      │
│  │ ┌────────────────────────────────┐     │      │
│  │ │ Write a comment...       [Send]│     │      │
│  │ └────────────────────────────────┘     │      │
│  └────────────────────────────────────────┘      │
│                                                   │
│  ┌── ACTIVITY ────────────────────────────┐      │
│  │ Mar 25 — Status changed: Todo → In Dev │      │
│  │ Mar 24 — Assigned to Aman S.           │      │
│  │ Mar 24 — Created by Varun K.           │      │
│  └────────────────────────────────────────┘      │
│                                                   │
└──────────────────────────────────────────────────┘
```

### 8.2 Drawer Actions Menu (⋮)

Open in full page, Move to board, Move to sprint, Duplicate, Copy task key, Copy task link, Watch/Unwatch, Save as task template, Archive, Delete.

---

## 9. Board Views

### 9.1 Available Views

| View | Description | Toggle Location |
|---|---|---|
| **Board (Kanban)** | Default column-based view with cards | View switcher in board header |
| **List View** | Table/spreadsheet view of all tasks on this board | View switcher |
| **Calendar View** | Tasks plotted on calendar by due date | View switcher |
| **Timeline (Gantt)** | Tasks shown as bars on timeline with dependencies | View switcher |

### 9.2 List View Columns

| Column | Default Visible | Sortable | Filterable |
|---|---|---|---|
| Task Key | Yes | Yes | Yes (search) |
| Title | Yes | Yes | Yes (search) |
| Status | Yes | Yes | Yes |
| Priority | Yes | Yes | Yes |
| Assignee | Yes | Yes | Yes |
| Type | Yes | Yes | Yes |
| Due Date | Yes | Yes | Yes |
| Story Points | Yes (scrum) | Yes | No |
| Labels | Yes | No | Yes |
| Sprint | Yes (scrum) | Yes | Yes |
| Created | No | Yes | Yes (range) |
| Updated | No | Yes | Yes (range) |
| Reporter | No | Yes | Yes |
| Logged Hours | No | Yes | No |
| Custom Fields | Configurable | Yes | Yes |

Users can show/hide columns, drag to reorder, and resize column widths. Configuration saved per user per board.

### 9.3 Calendar View

- Monthly calendar grid with task cards on their due dates
- Tasks without due dates shown in a sidebar "No Date" list
- Drag task to a date to set/change due date
- Color-coded by status or priority (user toggle)
- Click date to create new task with that due date
- Overdue tasks shown with red highlight

### 9.4 Timeline (Gantt) View

- Horizontal bars represent task duration (start date → due date)
- Tasks without both dates shown as milestones (single point)
- Dependency arrows between linked tasks
- Today line (red vertical line)
- Zoom: Day / Week / Month / Quarter
- Drag bar edges to change dates
- Critical path highlighting (if dependencies defined)

---

## 10. Board-Level Permissions

Boards inherit the project's team. Board permissions layer on top of project permissions.

### 10.1 Board Roles

| Board Permission | Project Admin | Project Manager | Tech Lead | Developer | QA | Viewer |
|---|---|---|---|---|---|---|
| View board | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Move tasks (drag & drop) | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Create tasks on board | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Edit task details | ✓ | ✓ | ✓ | Own tasks | Own tasks | ✗ |
| Add/edit columns | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Delete columns | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Change board settings | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Manage swimlanes | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage saved filters | ✓ | ✓ | ✓ | Own | Own | ✗ |
| Force WIP override | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Archive/delete board | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Save as board template | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

---

## 11. Board Analytics

### 11.1 Board Dashboard (Inline)

Expandable analytics panel at the top of the board view:

```
┌──────────────────────────────────────────────────────────────┐
│  📊 Board Analytics                              [Collapse ▲]│
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Total    │ │ In Prog  │ │ Blocked  │ │ Avg Cycle│       │
│  │ Tasks    │ │ Tasks    │ │          │ │ Time     │       │
│  │   42     │ │   12     │ │   3      │ │ 4.2 days │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                               │
│  Cumulative Flow Diagram          │ Cycle Time Distribution  │
│  ┌─────────────────────────┐      │ ┌─────────────────────┐  │
│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░│      │ │ ▌▌▌▌▌▌ 2-3 days   │  │
│  │▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░│      │ │ ▌▌▌▌   3-5 days   │  │
│  │▓▓▓▓▓▓░░░░░░░░░░░░░░░░│      │ │ ▌▌     5-7 days   │  │
│  └─────────────────────────┘      │ │ ▌       7+ days   │  │
│                                    │ └─────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 Available Metrics

| Metric | Description | Board Types |
|---|---|---|
| Total Tasks | Count of all tasks on board | All |
| Tasks by Status | Breakdown per column/status | All |
| Tasks by Assignee | Who has the most work | All |
| Blocked Tasks | Count of blocked items | All |
| WIP Utilization | Current / limit per column | All with WIP |
| Average Cycle Time | Avg days from `isStartColumn` to `isDoneColumn` | Kanban, Scrum |
| Cycle Time Distribution | Histogram of cycle times | Kanban, Scrum |
| Throughput | Tasks completed per day/week | All |
| Cumulative Flow Diagram | Stacked area chart of column counts over time | Kanban |
| Burndown Chart | Remaining work (points) over sprint | Scrum only |
| Burnup Chart | Completed vs total scope over sprint | Scrum only |
| Velocity | Story points completed per sprint | Scrum only |
| Lead Time | Time from task creation to completion | All |
| Aging Work | How long tasks have been in current column | All |

### 11.3 Aging Work Indicators

Tasks sitting in a column for too long get visual indicators:

| Aging | Visual | Threshold |
|---|---|---|
| Normal | No indicator | < 3 days |
| Aging | Yellow dot on card | 3-5 days |
| Stale | Orange dot on card | 5-10 days |
| Stuck | Red dot + "Stuck" badge | > 10 days |

Thresholds are configurable per board in settings.

---

## 12. Board Templates — Overview

### 12.1 Template Tiers

| Tier | Description | Created By |
|---|---|---|
| **System** | Pre-built by Nexora. Read-only. | Platform |
| **Organization** | Created by admins. Shared within org. | Org Admin, Project Manager |
| **Personal** | Created by individual users. Private. | Any member |

### 12.2 All 12 System Templates at a Glance

| # | Template | Board Type | Columns | WIP | Default Swimlane | Best For |
|---|---|---|---|---|---|---|
| 1 | Scrum Sprint Board | scrum | 5 | Yes | Assignee | Sprint execution |
| 2 | Standard Kanban | kanban | 4 | Yes | None | General development |
| 3 | Bug Tracker | bug_tracker | 6 | Yes | Priority | QA / bug management |
| 4 | DevOps Pipeline | kanban | 6 | Yes | None | CI/CD & deployments |
| 5 | Release Management | kanban | 5 | Yes | None | Release coordination |
| 6 | Support & Service Desk | kanban | 6 | Yes | Priority | IT support tickets |
| 7 | Design Sprint | custom | 5 | No | None | Design process |
| 8 | Content & Marketing | kanban | 5 | Yes | Label | Content pipeline |
| 9 | Client Onboarding | kanban | 5 | No | None | Client delivery |
| 10 | Recruitment Pipeline | kanban | 6 | No | None | HR / Recruitment |
| 11 | Eisenhower Priority Matrix | custom | 4 | No | None | Personal prioritization |
| 12 | Approval Workflow | kanban | 4 | No | None | Review & approval |

### 12.3 What Every Board Template Defines

| Component | Description |
|---|---|
| **Columns** | Name, key, order, color, WIP limit, status mapping |
| **Swimlane Config** | Enabled, groupBy, default lane |
| **Card Layout** | Which fields show on cards |
| **Quick Filters** | Which filter fields are pinned |
| **Column Automations** | Per-column auto-assign or auto-actions |
| **Saved Filters** | Pre-built filter presets |
| **Required Statuses** | Project statuses this board needs (validated at apply time) |
| **Team Role Suggestions** | Which project roles benefit from this board |

---

## 13. Template 1 — Scrum Sprint Board

**Description:** The primary board for sprint execution in Scrum teams. Tasks flow from backlog through development, review, and testing to done. Designed for team members to visualize their sprint work and for scrum masters to track progress.

**Board Type:** `scrum`

### Columns (5)

| # | Column | Key | Status Mapping | Color | WIP Limit | isStart | isDone |
|---|---|---|---|---|---|---|---|
| 1 | Sprint Backlog | `sprint_backlog` | `todo` | #64748B | 0 | false | false |
| 2 | In Development | `in_dev` | `in_dev`, `in_progress` | #F59E0B | 3 per dev | true | false |
| 3 | Code Review | `code_review` | `code_review`, `in_review` | #8B5CF6 | 2 | false | false |
| 4 | QA Testing | `qa_testing` | `qa_testing` | #06B6D4 | 2 | false | false |
| 5 | Done | `done` | `done` | #22C55E | 0 | false | true |

### Swimlane Config

```javascript
{
  enabled: true,
  groupBy: 'assignee',
  showEmpty: false,
  defaultLane: 'Unassigned',
  sortOrder: 'count-desc'
}
```

### Card Layout

```javascript
{
  showTaskKey: true,
  showAvatar: true,
  showPriority: true,
  showLabels: true,
  showEstimate: true,        // story points badge
  showDueDate: true,
  showSubtasks: true,
  showProgress: false,
  showCommentCount: true,
  showTypeIndicator: true,
  customFields: ['story_points', 'epic'],
  compactMode: false
}
```

### Quick Filters

`['assignee', 'priority', 'type', 'epic', 'labels']`

### Column Automations

| Column | Automation | Description |
|---|---|---|
| Code Review | Auto-notify | When task enters, notify team's tech lead |
| QA Testing | Auto-assign | Assign to round-robin from QA engineers on the team |
| Done | Auto-comment | Post "Completed in Sprint {sprintName}" comment |

### Required Project Statuses

`['todo', 'in_dev' or 'in_progress', 'code_review' or 'in_review', 'done']`

If the project doesn't have these statuses, the apply wizard shows a warning and offers to add them.

### Team Role Suggestions

Scrum Master, Tech Lead, Developer, QA Engineer

### Pre-Built Saved Filters

| Filter Name | Query | Shared |
|---|---|---|
| My Tasks | `assignee = currentUser` | No (per user) |
| Blocked Items | `status = blocked` | Yes |
| High Priority | `priority in [critical, high]` | Yes |
| Bugs Only | `type = bug` | Yes |

---

## 14. Template 2 — Standard Kanban

**Description:** A general-purpose Kanban board with continuous flow, WIP limits, and cycle time tracking. Works for any development team using a pull-based workflow.

**Board Type:** `kanban`

### Columns (4)

| # | Column | Key | Status Mapping | Color | WIP Limit | isStart | isDone |
|---|---|---|---|---|---|---|---|
| 1 | To Do | `todo` | `todo`, `backlog` | #3B82F6 | 0 | false | false |
| 2 | In Progress | `in_progress` | `in_progress`, `in_dev` | #F59E0B | 5 | true | false |
| 3 | In Review | `in_review` | `in_review`, `code_review` | #8B5CF6 | 3 | false | false |
| 4 | Done | `done` | `done` | #22C55E | 0 | false | true |

### Swimlane Config

```javascript
{ enabled: false }
```

### Card Layout

```javascript
{
  showTaskKey: true, showAvatar: true, showPriority: true,
  showLabels: true, showEstimate: true, showDueDate: true,
  showSubtasks: true, showCommentCount: true, showTypeIndicator: true,
  customFields: [],
  compactMode: false
}
```

### Quick Filters

`['assignee', 'priority', 'type', 'labels']`

### Column Automations

| Column | Automation |
|---|---|
| Done | Auto-set resolution date, notify reporter |

---

## 15. Template 3 — Bug Tracker Board

**Description:** Specialized board for triaging, tracking, and resolving bugs. Optimized for QA workflows with severity-based swimlanes and bug-specific custom fields.

**Board Type:** `bug_tracker`

### Columns (6)

| # | Column | Key | Status Mapping | Color | WIP | isStart | isDone |
|---|---|---|---|---|---|---|---|
| 1 | New | `new` | `new`, `backlog` | #94A3B8 | 0 | false | false |
| 2 | Triaged | `triaged` | `triaged` | #3B82F6 | 0 | false | false |
| 3 | In Progress | `in_progress` | `investigating`, `fix_in_progress`, `in_progress` | #F59E0B | 5 | true | false |
| 4 | Fixed | `fixed` | `fixed` | #8B5CF6 | 0 | false | false |
| 5 | Verified | `verified` | `verified` | #10B981 | 0 | false | true |
| 6 | Closed | `closed` | `closed`, `wont_fix`, `cannot_reproduce` | #6B7280 | 0 | false | true |

### Swimlane Config

```javascript
{
  enabled: true,
  groupBy: 'custom_field',
  fieldKey: 'severity',
  showEmpty: false,
  sortOrder: 'default',
  defaultLane: 'Unclassified'
}
```

Lanes (top to bottom): Blocker → Critical → Major → Minor → Trivial → Unclassified

### Card Layout

```javascript
{
  showTaskKey: true, showAvatar: true, showPriority: true,
  showLabels: false, showEstimate: false, showDueDate: true,
  showSubtasks: false, showCommentCount: true, showTypeIndicator: true,
  customFields: ['severity', 'affected_version', 'env_found'],
  compactMode: false
}
```

### Quick Filters

`['assignee', 'severity', 'env_found', 'affected_version', 'labels']`

### Column Automations

| Column | Automation |
|---|---|
| Triaged | Auto-set priority based on severity mapping: Blocker→Critical, Critical→High, Major→Medium, Minor/Trivial→Low |
| Fixed | Notify reporter that bug is fixed, assign back to reporter for verification |
| Closed | Auto-remove from active sprint if sprint board exists |

### Pre-Built Saved Filters

| Filter Name | Query |
|---|---|
| Blockers & Criticals | `severity in [blocker, critical]` |
| My Reported Bugs | `reporter = currentUser` |
| Unassigned Bugs | `assignee = null` |
| Production Bugs | `env_found = production` |
| Regression Bugs | `labels contains 'regression'` |

---

## 16. Template 4 — DevOps Pipeline Board

**Description:** Tracks infrastructure tasks, deployments, and operational work through stages from planning to production verification.

**Board Type:** `kanban`

### Columns (6)

| # | Column | Key | Status Mapping | Color | WIP | isStart | isDone |
|---|---|---|---|---|---|---|---|
| 1 | Backlog | `backlog` | `backlog`, `todo` | #94A3B8 | 0 | false | false |
| 2 | In Progress | `in_progress` | `in_progress` | #F59E0B | 4 | true | false |
| 3 | Review / PR | `review` | `in_review`, `code_review` | #8B5CF6 | 2 | false | false |
| 4 | Staging | `staging` | `qa_testing` | #6366F1 | 2 | false | false |
| 5 | Deploying | `deploying` | `deploying` | #F97316 | 1 | false | false |
| 6 | Production | `production` | `done` | #22C55E | 0 | false | true |

### Swimlane Config

```javascript
{
  enabled: true,
  groupBy: 'custom_field',
  fieldKey: 'environment',
  showEmpty: true,
  sortOrder: 'default',
  defaultLane: 'General'
}
```

### Card Layout

```javascript
{
  showTaskKey: true, showAvatar: true, showPriority: true,
  showLabels: true, showEstimate: false, showDueDate: true,
  showSubtasks: true, showCommentCount: false, showTypeIndicator: true,
  customFields: ['environment', 'service', 'deployment_type'],
  compactMode: false
}
```

### Quick Filters

`['assignee', 'priority', 'environment', 'service']`

### Column Automations

| Column | Automation |
|---|---|
| Staging | Notify QA: "{{task.taskKey}} deployed to staging — ready for smoke test" |
| Deploying | Set WIP to 1 (only one deployment at a time), notify DevOps channel |
| Production | Auto-comment: "Deployed to production at {{timestamp}}", notify project manager |

---

## 17. Template 5 — Release Management Board

**Description:** Coordinates features, fixes, and dependencies across releases. Tracks what goes into each release version.

**Board Type:** `kanban`

### Columns (5)

| # | Column | Key | Status Mapping | Color | WIP |
|---|---|---|---|---|---|
| 1 | Planned | `planned` | `backlog`, `todo` | #94A3B8 | 0 |
| 2 | In Development | `in_dev` | `in_progress`, `in_dev` | #F59E0B | 0 |
| 3 | Ready for Release | `ready` | `in_review`, `qa_testing` | #84CC16 | 0 |
| 4 | Released | `released` | `done` | #22C55E | 0 |
| 5 | Rolled Back | `rolled_back` | `blocked` | #EF4444 | 0 |

### Swimlane Config

```javascript
{
  enabled: true,
  groupBy: 'custom_field',
  fieldKey: 'release_version',
  showEmpty: false,
  sortOrder: 'desc',
  defaultLane: 'Unassigned Release'
}
```

### Quick Filters

`['release_version', 'type', 'priority', 'assignee']`

### Column Automations

| Column | Automation |
|---|---|
| Released | Auto-comment: "Included in release {{release_version}}", notify reporter |
| Rolled Back | Set priority to critical, notify tech lead and project manager |

---

## 18. Template 6 — Support & Service Desk Board

**Description:** Handles incoming support tickets with SLA-aware column routing, escalation paths, and customer communication tracking.

**Board Type:** `kanban`

### Columns (6)

| # | Column | Key | Status Mapping | Color | WIP |
|---|---|---|---|---|---|
| 1 | Open | `open` | `open`, `backlog` | #94A3B8 | 0 |
| 2 | Assigned | `assigned` | `assigned`, `todo` | #3B82F6 | 0 |
| 3 | In Progress | `in_progress` | `in_progress` | #F59E0B | 5 |
| 4 | Waiting on Client | `waiting_client` | `waiting_client`, `blocked` | #F97316 | 0 |
| 5 | Resolved | `resolved` | `resolved` | #22C55E | 0 |
| 6 | Closed | `closed` | `closed`, `done` | #6B7280 | 0 |

### Swimlane Config

```javascript
{
  enabled: true,
  groupBy: 'custom_field',
  fieldKey: 'sla_priority',
  showEmpty: true,
  sortOrder: 'default',
  defaultLane: 'P4 (24h response)'
}
```

Lanes: P1 (1h response) → P2 (4h) → P3 (8h) → P4 (24h)

### Card Layout

```javascript
{
  showTaskKey: true, showAvatar: true, showPriority: true,
  showLabels: true, showEstimate: false, showDueDate: true,
  showSubtasks: false, showCommentCount: true, showTypeIndicator: true,
  customFields: ['sla_priority', 'ticket_type', 'affected_system'],
  compactMode: false
}
```

### Quick Filters

`['assignee', 'sla_priority', 'ticket_type', 'affected_system']`

### Column Automations

| Column | Automation |
|---|---|
| Open | Auto-assign to round-robin from L1 support engineers |
| Waiting on Client | Start "client response" timer, auto-close after 7 days of no response |
| Resolved | Notify ticket requester: "Your issue has been resolved", start 48h auto-close timer |
| Closed | Log resolution time, update SLA metrics |

### Pre-Built Saved Filters

| Filter Name | Query |
|---|---|
| SLA Breached | `dueDate < now AND status NOT IN [resolved, closed]` |
| P1 Tickets | `sla_priority = P1` |
| Unassigned | `assignee = null` |
| Waiting > 3 Days | `status = waiting_client AND lastUpdated < 3 days ago` |

---

## 19. Template 7 — Design Sprint Board

**Description:** Follows the Google Ventures Design Sprint methodology: Understand, Diverge, Converge, Prototype, Test. Each column represents a day/phase of the sprint.

**Board Type:** `custom`

### Columns (5)

| # | Column | Key | Status Mapping | Color | WIP |
|---|---|---|---|---|---|
| 1 | Understand | `understand` | `backlog`, `todo` | #3B82F6 | 0 |
| 2 | Diverge | `diverge` | `in_progress` | #8B5CF6 | 0 |
| 3 | Converge | `converge` | `in_review` | #F59E0B | 0 |
| 4 | Prototype | `prototype` | `in_progress` | #EC4899 | 0 |
| 5 | Test | `test` | `done` | #22C55E | 0 |

### Card Layout

```javascript
{
  showTaskKey: true, showAvatar: true, showPriority: false,
  showLabels: true, showEstimate: false, showDueDate: false,
  showSubtasks: true, showCommentCount: true, showTypeIndicator: false,
  customFields: [],
  compactMode: false
}
```

### Quick Filters

`['assignee', 'labels']`

---

## 20. Template 8 — Content & Marketing Board

**Description:** Tracks content production from ideation to publication across channels. Swimlanes by content channel.

**Board Type:** `kanban`

### Columns (5)

| # | Column | Key | Status Mapping | Color | WIP |
|---|---|---|---|---|---|
| 1 | Ideas | `ideas` | `backlog` | #94A3B8 | 0 |
| 2 | Drafting | `drafting` | `in_progress` | #F59E0B | 3 |
| 3 | Review / Edit | `review` | `in_review` | #8B5CF6 | 2 |
| 4 | Scheduled | `scheduled` | `todo` | #6366F1 | 0 |
| 5 | Published | `published` | `done` | #22C55E | 0 |

### Swimlane Config

```javascript
{
  enabled: true,
  groupBy: 'label',
  showEmpty: true,
  sortOrder: 'default',
  defaultLane: 'Uncategorized'
}
```

Expected lanes: Blog, Social Media, Email Newsletter, Video, Case Study, etc.

### Card Layout

```javascript
{
  showTaskKey: true, showAvatar: true, showPriority: false,
  showLabels: true, showEstimate: false, showDueDate: true,
  showSubtasks: true, showCommentCount: true, showTypeIndicator: false,
  showAttachmentCount: true,
  customFields: ['content_channel', 'publish_date', 'target_audience'],
  compactMode: false
}
```

### Quick Filters

`['assignee', 'labels', 'content_channel', 'publish_date']`

### Column Automations

| Column | Automation |
|---|---|
| Review / Edit | Notify designated editor/reviewer |
| Published | Add "Published" label, set completed date |

---

## 21. Template 9 — Client Onboarding Board

**Description:** Tracks client delivery milestones from intake through handover. Each column represents a phase of the engagement.

**Board Type:** `kanban`

### Columns (5)

| # | Column | Key | Status Mapping | Color | WIP |
|---|---|---|---|---|---|
| 1 | Intake | `intake` | `backlog`, `todo` | #94A3B8 | 0 |
| 2 | Discovery | `discovery` | `in_progress` | #3B82F6 | 0 |
| 3 | Setup & Config | `setup` | `in_progress` | #F59E0B | 3 |
| 4 | Training | `training` | `in_review` | #8B5CF6 | 0 |
| 5 | Handed Off | `handoff` | `done` | #22C55E | 0 |

### Quick Filters

`['assignee', 'priority', 'labels']`

### Column Automations

| Column | Automation |
|---|---|
| Discovery | Auto-create checklist: "Discovery Questions" with 5 default items |
| Setup & Config | Notify tech lead: "Client ready for technical setup" |
| Handed Off | Notify account manager, trigger client satisfaction survey |

---

## 22. Template 10 — Recruitment Pipeline Board

**Description:** Tracks candidates through the hiring pipeline from application to offer. Optimized for HR teams and hiring managers.

**Board Type:** `kanban`

### Columns (6)

| # | Column | Key | Status Mapping | Color | WIP |
|---|---|---|---|---|---|
| 1 | Applied | `applied` | `backlog` | #94A3B8 | 0 |
| 2 | Screening | `screening` | `todo` | #3B82F6 | 0 |
| 3 | Interview | `interview` | `in_progress` | #F59E0B | 5 |
| 4 | Evaluation | `evaluation` | `in_review` | #8B5CF6 | 0 |
| 5 | Offer | `offer` | `in_progress` | #84CC16 | 0 |
| 6 | Hired / Rejected | `closed` | `done`, `cancelled` | #22C55E | 0 |

### Card Layout

```javascript
{
  showTaskKey: true, showAvatar: false, showPriority: true,
  showLabels: true, showEstimate: false, showDueDate: true,
  showSubtasks: false, showCommentCount: true, showTypeIndicator: false,
  customFields: ['position', 'seniority', 'interview_stage', 'source'],
  compactMode: false
}
```

### Quick Filters

`['position', 'seniority', 'source', 'labels']`

### Column Automations

| Column | Automation |
|---|---|
| Screening | Auto-create checklist: "Screening Questions" |
| Interview | Notify hiring manager, create calendar placeholder |
| Offer | Notify HR director for approval |
| Hired / Rejected | Notify candidate (via email template), archive after 30 days |

---

## 23. Template 11 — Eisenhower Priority Matrix

**Description:** Four-quadrant priority matrix for personal task management. Columns represent urgency × importance.

**Board Type:** `custom`

### Columns (4)

| # | Column | Key | Status Mapping | Color | WIP |
|---|---|---|---|---|---|
| 1 | Do First (Urgent + Important) | `do_first` | `in_progress` | #EF4444 | 3 |
| 2 | Schedule (Important, Not Urgent) | `schedule` | `todo` | #3B82F6 | 0 |
| 3 | Delegate (Urgent, Not Important) | `delegate` | `todo` | #F59E0B | 0 |
| 4 | Eliminate (Neither) | `eliminate` | `cancelled`, `backlog` | #94A3B8 | 0 |

### Card Layout

```javascript
{
  showTaskKey: true, showAvatar: true, showPriority: false,
  showLabels: true, showEstimate: false, showDueDate: true,
  showSubtasks: false, showCommentCount: false, showTypeIndicator: false,
  customFields: [],
  compactMode: true
}
```

### Quick Filters

`['assignee', 'dueDate', 'labels']`

---

## 24. Template 12 — Approval Workflow Board

**Description:** Tracks items requiring review and approval — documents, designs, proposals, invoices, change requests.

**Board Type:** `kanban`

### Columns (4)

| # | Column | Key | Status Mapping | Color | WIP |
|---|---|---|---|---|---|
| 1 | Submitted | `submitted` | `todo`, `backlog` | #94A3B8 | 0 |
| 2 | Under Review | `under_review` | `in_review` | #F59E0B | 3 |
| 3 | Approved | `approved` | `done` | #22C55E | 0 |
| 4 | Rejected | `rejected` | `blocked`, `cancelled` | #EF4444 | 0 |

### Swimlane Config

```javascript
{
  enabled: true,
  groupBy: 'custom_field',
  fieldKey: 'approval_type',
  showEmpty: true,
  sortOrder: 'default'
}
```

Expected lanes: Document Review, Design Approval, Budget Approval, Change Request, Invoice Approval

### Card Layout

```javascript
{
  showTaskKey: true, showAvatar: true, showPriority: true,
  showLabels: true, showEstimate: false, showDueDate: true,
  showSubtasks: false, showCommentCount: true, showTypeIndicator: false,
  showAttachmentCount: true,
  customFields: ['approval_type', 'approver', 'urgency'],
  compactMode: false
}
```

### Column Automations

| Column | Automation |
|---|---|
| Under Review | Assign to designated approver from `approver` custom field, set due date +3 days |
| Approved | Notify submitter: "Your {{approval_type}} has been approved", add "Approved" label |
| Rejected | Notify submitter: "Your {{approval_type}} needs revision — see comments", move back to Submitted after revision |

---

## 25. Template Application Engine

### 25.1 How Board Templates Are Applied

Board templates can be applied in three contexts:

**Context 1 — As Part of a Project Template:**
When a project template is applied, its embedded board definitions are created automatically. No separate board template apply step.

**Context 2 — Adding a Board to an Existing Project:**
User clicks "+ New Board" within a project → sees template picker → fills variables → board created.

**Context 3 — Standalone Board Creation:**
User creates a board from the board template gallery, selecting which project it belongs to.

### 25.2 Board Template Apply Wizard

```
Step 1: Choose Template
┌─────────────────────────────────────────────────┐
│  Add Board to: "E-Commerce Rewrite"              │
│                                                   │
│  Choose a board template:                         │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ 🏃 Scrum│ │ 📋 Kanban│ │ 🐛 Bug  │         │
│  │ Sprint   │ │ Standard │ │ Tracker  │         │
│  ├──────────┤ ├──────────┤ ├──────────┤         │
│  │ 🚀DevOps│ │ 📦Release│ │ 🎫Support│         │
│  ├──────────┤ ├──────────┤ ├──────────┤         │
│  │ 🎨Design│ │ 📝Content│ │ 🤝Client │         │
│  ├──────────┤ ├──────────┤ ├──────────┤         │
│  │ 👥Recruit│ │ 📊Matrix │ │ ✅Approve│         │
│  └──────────┘ └──────────┘ └──────────┘         │
│                                                   │
│  [Blank Board]                                    │
│                              [Cancel] [Next →]    │
└─────────────────────────────────────────────────┘

Step 2: Configure
┌─────────────────────────────────────────────────┐
│  Configure: "Scrum Sprint Board"                  │
│                                                   │
│  Board Name: [Sprint Board          ]             │
│                                                   │
│  Column Customization:                            │
│  ┌──────────────────────────────────────────┐    │
│  │ 1. Sprint Backlog    [todo ▾]   WIP: [0] │    │
│  │ 2. In Development    [in_dev ▾] WIP: [3] │    │
│  │ 3. Code Review       [review ▾] WIP: [2] │    │
│  │ 4. QA Testing        [qa ▾]     WIP: [2] │    │
│  │ 5. Done              [done ▾]   WIP: [0] │    │
│  │ [+ Add Column]                            │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  ⚠ Your project is missing status "qa_testing".  │
│    [Add it now] or [Skip — map to "in_review"]    │
│                                                   │
│  Swimlanes: [✓] Enable   Group By: [Assignee ▾]  │
│                                                   │
│  ☑ Apply column automations                       │
│  ☑ Create saved filters                           │
│                                                   │
│                          [← Back] [Create Board]  │
└─────────────────────────────────────────────────┘
```

### 25.3 Status Compatibility Check

Before creating a board from a template, the engine checks whether the project has the required statuses:

```javascript
async function checkStatusCompatibility(projectId, boardTemplate) {
  const project = await Project.findById(projectId);
  const projectStatusKeys = project.statuses.map(s => s.key);

  const requiredStatuses = boardTemplate.columns
    .flatMap(col => col.statusMapping);

  const missing = requiredStatuses.filter(s => !projectStatusKeys.includes(s));

  return {
    compatible: missing.length === 0,
    missingStatuses: missing,
    suggestions: missing.map(s => ({
      key: s,
      name: s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      mapTo: findClosestProjectStatus(s, projectStatusKeys)
    }))
  };
}
```

User can either add missing statuses to the project or remap columns to existing statuses.

### 25.4 Apply API

`POST /api/v1/boards/from-template`

**Request:**
```json
{
  "templateId": "tpl_brd_scrum",
  "projectId": "proj_abc",
  "name": "Sprint Board",
  "overrides": {
    "columns[1].wipLimit": 4,
    "swimlaneConfig.groupBy": "priority"
  },
  "statusMappingOverrides": {
    "qa_testing": "in_review"
  },
  "createAutomations": true,
  "createSavedFilters": true
}
```

**Response:**
```json
{
  "success": true,
  "board": {
    "id": "brd_new123",
    "name": "Sprint Board",
    "type": "scrum",
    "projectId": "proj_abc",
    "columns": 5,
    "swimlaneEnabled": true,
    "url": "/boards/brd_new123"
  },
  "created": {
    "columns": 5,
    "automations": 3,
    "savedFilters": 4
  },
  "warnings": [
    "Status 'qa_testing' not found in project. Mapped to 'in_review' as requested."
  ]
}
```

---

## 26. Save Board as Template

Any existing board can be saved as a reusable template.

`POST /api/v1/templates/from-board/:boardId`

**Request:**
```json
{
  "name": "Our Custom Sprint Board",
  "description": "Sprint board with extra QA columns",
  "tier": "organization",
  "tags": ["scrum", "qa-heavy"]
}
```

**What gets extracted:**
- Board type, columns (names, keys, order, colors, WIP limits, status mappings)
- Swimlane configuration
- Card layout configuration
- Quick filters
- Column automations (generalized — user IDs replaced with role references)
- Saved filters (shared ones only)

**What gets stripped:**
- Board ID, project ID, organization ID
- User-specific data (column owners mapped to roles)
- Non-shared saved filters

---

## 27. Board ↔ Project Integration

### 27.1 Inheritance from Project

| From Project | Used By Board | How |
|---|---|---|
| Statuses | Column → status mapping | Each column references project status keys |
| Custom fields | Card layout, filters | Board chooses which custom fields to show |
| Labels | Card labels, swimlanes, filters | Board references project labels |
| Team members | Swimlanes, assignee filter, auto-assign | Board inherits project team roster |
| Settings (boardType) | Board type, sprint support | Determines scrum vs kanban behavior |
| Settings (estimationUnit) | Card layout (points vs hours) | Determines what estimate field to show |
| Workflow transitions | Drag-and-drop validation | If transitions defined, enforced on column moves |

### 27.2 Board Events That Affect Project

| Board Event | Project Impact |
|---|---|
| Task moved to done column | Project progress % recalculated |
| Task moved to blocked | Project health score may decrease |
| All sprint tasks done | Sprint velocity calculated, milestone may auto-complete |
| WIP limit breached | Project activity logged |

### 27.3 Board List on Project Detail

The project detail page shows all boards as tabs or cards:

```
┌─────────────────────────────────────────────────────────────┐
│  Project: E-Commerce Rewrite                                 │
│                                                               │
│  BOARDS                                                       │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────────┐ │
│  │ 🏃 Sprint Board│ │ 📋 Backlog     │ │ 🐛 Bug Tracker  │ │
│  │ Scrum          │ │ Kanban         │ │ Bug Tracker      │ │
│  │ 18 tasks       │ │ 24 tasks       │ │ 7 tasks         │ │
│  │ ★ Default      │ │                │ │                  │ │
│  └────────────────┘ └────────────────┘ └──────────────────┘ │
│                                                               │
│  [+ Add Board]  [+ From Template]                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 28. Board ↔ Team Integration

### 28.1 Team-Aware Features on Boards

| Feature | Team Data Used | How |
|---|---|---|
| Assignee swimlanes | `team[].userId`, `team[].projectRole` | One lane per team member, shows role badge |
| Assignee filter | `team[].userId` | Quick filter shows only project team members |
| Auto-assign (round-robin) | `team[]` filtered by role | Column automation cycles through members with matching role |
| Auto-assign (least-loaded) | `team[].userId` + task count | Assigns to team member with fewest in-progress tasks |
| Column owner | `team[].userId` | Column header shows owner avatar, gets notified on column events |
| Workload visualization | `team[].allocationPercentage` + assigned task count | Swimlane header shows allocated vs. actual task load |

### 28.2 Workload Indicator in Swimlanes

When swimlanes are grouped by assignee, each lane header shows:

```
┌──────────────────────────────────────────────────────────┐
│ 👤 Aman S. (Tech Lead, 100%)    📊 5 tasks  ██████░ 83% │
└──────────────────────────────────────────────────────────┘
```

- Name, role, allocation percentage from project team
- Active task count on this board
- Workload bar: tasks / capacity estimate (based on allocation × WIP norms)
- Color: Green (<70%), Amber (70-90%), Red (>90%)

### 28.3 Team Permissions on Board

When a team member's project role changes, their board permissions automatically update (see Section 10). No separate board-level role assignment needed.

---

## 29. Board ↔ Sprint Integration

### 29.1 Sprint Overlay on Scrum Boards

Scrum boards have built-in sprint support:

```
┌──────────────────────────────────────────────────────────────┐
│  Sprint Board                                                 │
│                                                               │
│  ┌── SPRINT HEADER ──────────────────────────────────────┐   │
│  │ 🏃 Sprint 3: "Auth & Dashboard"                       │   │
│  │ Mar 18 — Mar 31  │  8 of 12 SP complete  │  3 days left│   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░ 67%     │   │
│  │                                                        │   │
│  │ [◀ Sprint 2 (completed)]  [Sprint 4 (planning) ▶]    │   │
│  │                          [Complete Sprint]             │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Sprint    │ │In Dev    │ │Code      │ │Done      │       │
│  │Backlog   │ │(2/3)     │ │Review    │ │          │       │
│  │          │ │          │ │(1/2)     │ │          │       │
│  │ Cards... │ │ Cards... │ │ Cards... │ │ Cards... │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                               │
│  ┌── BACKLOG (not in sprint) ────────────────────────────┐   │
│  │ WEB-050  WEB-051  WEB-052  WEB-053  ... (+18 more)    │   │
│  │ Drag tasks here ↑ to add to active sprint              │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 29.2 Sprint Controls

| Action | When Available | What Happens |
|---|---|---|
| Create Sprint | Always | Creates new sprint in `planning` status |
| Start Sprint | Status = planning, has tasks, no other active sprint | Sets active, start date |
| Complete Sprint | Status = active | Calculates velocity, handles incomplete tasks |
| Add to Sprint | Sprint exists, task on this board | Sets task.sprintId |
| Remove from Sprint | Task is in a sprint | Clears task.sprintId |

### 29.3 Sprint Completion Dialog

```
┌──────────────────────────────────────────────────┐
│  Complete Sprint 3                                │
│                                                   │
│  ✅ Completed: 8 tasks (42 story points)          │
│  ⚠️ Incomplete: 4 tasks (18 story points)         │
│                                                   │
│  What to do with incomplete tasks?                │
│                                                   │
│  ○ Move to backlog (remove from any sprint)       │
│  ● Move to Sprint 4 (planning)                    │
│  ○ Keep in current sprint (mark as carried over)  │
│                                                   │
│  Sprint Velocity: 42 SP                           │
│  (Previous sprints: 38, 40, 35, 42)              │
│                                                   │
│               [Cancel]  [Complete Sprint]          │
└──────────────────────────────────────────────────┘
```

---

## 30. Board Automations

Automations can be scoped to a specific board (in addition to project-level automations).

### 30.1 Board-Specific Triggers

| Trigger | Description | Conditions |
|---|---|---|
| `task.entered_column` | Task moved into a specific column | columnKey |
| `task.exited_column` | Task moved out of a specific column | columnKey |
| `board.wip_exceeded` | Column WIP limit reached or exceeded | columnKey |
| `board.wip_recovered` | Column WIP drops below limit | columnKey |
| `task.aging` | Task has been in same column for N+ days | columnKey, days |
| `task.created_on_board` | New task created directly on this board | — |

### 30.2 Board-Specific Actions

| Action | Description | Config |
|---|---|---|
| `auto-assign-column-owner` | Assign task to column's designated owner | — |
| `auto-assign-round-robin` | Cycle assignment through team members with specified role | `{ role }` |
| `auto-assign-least-loaded` | Assign to team member with fewest active tasks | `{ role }` |
| `highlight-card` | Add visual indicator to card | `{ color, badge }` |
| `move-to-column` | Move task to another column on same board | `{ targetColumnKey }` |
| `create-checklist` | Auto-create a checklist on the task | `{ name, items[] }` |
| `notify-column-owner` | Send notification to column's owner | `{ message }` |

### 30.3 Automation Execution Order

When a task is moved to a new column:
1. Validate workflow transition (if transitions defined)
2. Check WIP limit
3. Update task status (from column's statusMapping)
4. Execute column automations (in order defined)
5. Execute project-level automations (matching trigger)
6. Log activity
7. Fire WebSocket events
8. Send notifications

---

## 31. API Endpoints

### Board CRUD

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/boards` | Create board (blank or from inline definition) |
| POST | `/api/v1/boards/from-template` | Create board from template |
| GET | `/api/v1/boards/project/:projectId` | Get all boards for a project |
| GET | `/api/v1/boards/:id` | Get board detail (includes columns, swimlane config, card layout) |
| PUT | `/api/v1/boards/:id` | Update board (name, description, swimlane config, card layout) |
| DELETE | `/api/v1/boards/:id` | Soft-delete board |
| PATCH | `/api/v1/boards/:id/archive` | Archive board |
| PATCH | `/api/v1/boards/:id/restore` | Restore archived board |
| PATCH | `/api/v1/boards/:id/set-default` | Set as project's default board |

### Column Operations

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/boards/:id/columns` | Add column |
| PUT | `/api/v1/boards/:id/columns/:colId` | Update column |
| DELETE | `/api/v1/boards/:id/columns/:colId` | Delete column (move tasks to first col) |
| PUT | `/api/v1/boards/:id/columns/reorder` | Reorder columns |
| PATCH | `/api/v1/boards/:id/columns/:colId/collapse` | Toggle column collapse |

### Task Movement

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/boards/:id/tasks/move` | Move task between columns/swimlanes |
| PATCH | `/api/v1/boards/:id/tasks/reorder` | Reorder tasks within a column |

### Board Filters

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/boards/:id/filters` | Get saved filters for board |
| POST | `/api/v1/boards/:id/filters` | Create saved filter |
| PUT | `/api/v1/boards/:id/filters/:filterId` | Update saved filter |
| DELETE | `/api/v1/boards/:id/filters/:filterId` | Delete saved filter |

### Board Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/boards/:id/analytics` | Board metrics (cycle time, throughput, WIP) |
| GET | `/api/v1/boards/:id/analytics/cfd` | Cumulative flow diagram data |
| GET | `/api/v1/boards/:id/analytics/aging` | Aging work items |

### Board Templates

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/board-templates` | List all board templates |
| GET | `/api/v1/board-templates/:id` | Get template detail |
| GET | `/api/v1/board-templates/:id/preview` | Preview with status compatibility check |
| POST | `/api/v1/templates/from-board/:boardId` | Save existing board as template |

---

## 32. Database Schema

### Board Collection

```javascript
const BoardSchema = new mongoose.Schema({
  name:            { type: String, required: true, maxlength: 100 },
  description:     { type: String, maxlength: 500 },
  projectId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  organizationId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  type:            { type: String, enum: ['scrum', 'kanban', 'bug_tracker', 'custom'], required: true },

  columns: [{
    id:             { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    name:           { type: String, required: true, maxlength: 50 },
    key:            { type: String, required: true },
    order:          { type: Number, required: true },
    statusMapping:  [String],
    color:          { type: String, default: '#94A3B8' },
    wipLimit:       { type: Number, default: 0, min: 0 },
    isCollapsed:    { type: Boolean, default: false },
    isDoneColumn:   { type: Boolean, default: false },
    isStartColumn:  { type: Boolean, default: false },
    autoAssignRule: {
      type:   { type: String, enum: ['none', 'column-owner', 'round-robin', 'least-loaded'], default: 'none' },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    columnOwnerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  swimlaneConfig: {
    enabled:     { type: Boolean, default: false },
    groupBy:     { type: String, enum: ['assignee', 'priority', 'type', 'label', 'epic', 'sprint', 'custom_field', 'status_category'], default: 'assignee' },
    fieldKey:    String,
    showEmpty:   { type: Boolean, default: false },
    collapsed:   [String],
    sortOrder:   { type: String, default: 'default' },
    defaultLane: { type: String, default: 'Unassigned' }
  },

  cardLayout: {
    showTaskKey:          { type: Boolean, default: true },
    showAvatar:           { type: Boolean, default: true },
    showPriority:         { type: Boolean, default: true },
    showLabels:           { type: Boolean, default: true },
    showEstimate:         { type: Boolean, default: true },
    showDueDate:          { type: Boolean, default: true },
    showSubtasks:         { type: Boolean, default: true },
    showProgress:         { type: Boolean, default: false },
    showCommentCount:     { type: Boolean, default: true },
    showAttachmentCount:  { type: Boolean, default: false },
    showTypeIndicator:    { type: Boolean, default: true },
    showChecklistProgress: { type: Boolean, default: false },
    customFields:         [String],
    compactMode:          { type: Boolean, default: false }
  },

  quickFilters:    [String],
  savedFilters:    [{
    id:        { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    name:      String,
    query:     mongoose.Schema.Types.Mixed,
    isShared:  { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  isDefault:    { type: Boolean, default: false },
  isArchived:   { type: Boolean, default: false },
  isDeleted:    { type: Boolean, default: false },
  color:        String,
  icon:         { type: String, default: 'layout-kanban' },
  templateRef:  { type: mongoose.Schema.Types.ObjectId, ref: 'BoardTemplate' },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

}, { timestamps: true });

// Indexes
BoardSchema.index({ projectId: 1, isDeleted: 1 });
BoardSchema.index({ organizationId: 1 });
BoardSchema.index({ projectId: 1, isDefault: 1 });
BoardSchema.index({ name: 1, projectId: 1 });
```

### Board Template Collection

```javascript
const BoardTemplateSchema = new mongoose.Schema({
  name:           { type: String, required: true, maxlength: 120 },
  slug:           { type: String, unique: true },
  description:    { type: String, maxlength: 2000 },
  icon:           String,
  coverImage:     String,
  tags:           [String],

  tier:           { type: String, enum: ['system', 'organization', 'personal'], default: 'personal' },
  visibility:     { type: String, enum: ['public', 'private', 'org-only'], default: 'org-only' },
  status:         { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },

  boardType:      { type: String, enum: ['scrum', 'kanban', 'bug_tracker', 'custom'], required: true },

  columns: [{
    name: String, key: String, order: Number, statusMapping: [String],
    color: String, wipLimit: Number, isDoneColumn: Boolean, isStartColumn: Boolean,
    autoAssignRule: { type: String, config: mongoose.Schema.Types.Mixed }
  }],

  swimlaneConfig: {
    enabled: Boolean, groupBy: String, fieldKey: String,
    showEmpty: Boolean, sortOrder: String, defaultLane: String
  },

  cardLayout:     mongoose.Schema.Types.Mixed,
  quickFilters:   [String],
  savedFilters:   [{ name: String, query: mongoose.Schema.Types.Mixed }],

  requiredStatuses:   [String],
  teamRoleSuggestions: [String],

  // Analytics
  usageCount:     { type: Number, default: 0 },
  rating:         { type: Number, default: 0 },
  ratingCount:    { type: Number, default: 0 },

  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },

}, { timestamps: true });

BoardTemplateSchema.index({ tier: 1, status: 1 });
BoardTemplateSchema.index({ slug: 1 }, { unique: true });
BoardTemplateSchema.index({ boardType: 1 });
BoardTemplateSchema.index({ usageCount: -1 });
BoardTemplateSchema.index({ name: 'text', description: 'text', tags: 'text' });
```

---

## 33. Frontend Pages & Components

### 33.1 Routes

| Route | Page | Key Features |
|---|---|---|
| `/projects/:id/boards` | Board List | All boards in project as cards, + New Board, + From Template |
| `/projects/:id/boards/:boardId` | Board View | Kanban columns, drag-drop, filters, swimlanes, sprint header, analytics |
| `/projects/:id/boards/:boardId/list` | List View | Sortable table of all board tasks |
| `/projects/:id/boards/:boardId/calendar` | Calendar View | Tasks on monthly calendar by due date |
| `/projects/:id/boards/:boardId/timeline` | Timeline View | Gantt chart with dependencies |
| `/projects/:id/boards/:boardId/settings` | Board Settings | Columns, swimlanes, card layout, automations, filters |
| `/board-templates` | Template Gallery | Browse/search board templates |

### 33.2 Component Tree

```
src/features/boards/
├── pages/
│   ├── BoardListPage.jsx
│   ├── BoardViewPage.jsx
│   ├── BoardListViewPage.jsx
│   ├── BoardCalendarPage.jsx
│   ├── BoardTimelinePage.jsx
│   ├── BoardSettingsPage.jsx
│   └── BoardTemplateGalleryPage.jsx
│
├── components/
│   ├── board/
│   │   ├── KanbanBoard.jsx              Main board container
│   │   ├── KanbanColumn.jsx             Single column with header + card list
│   │   ├── ColumnHeader.jsx             Name, WIP indicator, menu
│   │   ├── ColumnDropZone.jsx           Drop target area per column
│   │   ├── AddColumnButton.jsx          "+ Add Column" at end of board
│   │   ├── BoardHeader.jsx              Board name, view switcher, settings gear
│   │   └── BoardEmptyState.jsx          When board has no tasks
│   │
│   ├── cards/
│   │   ├── TaskCard.jsx                 Complete task card component
│   │   ├── TaskCardCompact.jsx          Compact mode variant
│   │   ├── TaskCardSkeleton.jsx         Loading placeholder
│   │   ├── CardContextMenu.jsx          Right-click menu
│   │   ├── CardDragPreview.jsx          Ghost card during drag
│   │   ├── PriorityDot.jsx             Priority indicator
│   │   ├── TypeBorder.jsx              Left-side type color border
│   │   ├── EstimateBadge.jsx           Story points / hours badge
│   │   ├── DueDateBadge.jsx            Due date with overdue styling
│   │   └── SubtaskCounter.jsx          "3/5" subtask progress
│   │
│   ├── swimlanes/
│   │   ├── SwimlanContainer.jsx         Swimlane wrapper
│   │   ├── SwimlaneLane.jsx             Single lane (header + columns grid)
│   │   ├── SwimlaneHeader.jsx           Lane label, count, collapse toggle
│   │   └── SwimlaneAssigneeInfo.jsx     Avatar, role, workload bar
│   │
│   ├── filters/
│   │   ├── QuickFilterBar.jsx           Top filter bar
│   │   ├── AssigneeFilter.jsx           Avatar chip picker
│   │   ├── PriorityFilter.jsx           Priority dropdown
│   │   ├── TypeFilter.jsx               Task type dropdown
│   │   ├── LabelFilter.jsx              Label multi-select
│   │   ├── DueDateFilter.jsx            Date preset picker
│   │   ├── AdvancedFilterPanel.jsx      Expandable advanced filters
│   │   ├── SavedFilterBar.jsx           Saved filter pills
│   │   └── SaveFilterModal.jsx          Save filter form
│   │
│   ├── drawer/
│   │   ├── TaskDetailDrawer.jsx         Full drawer component
│   │   ├── DrawerHeader.jsx             Task key, title, close
│   │   ├── DrawerProperties.jsx         Status, assignee, priority grid
│   │   ├── DrawerCustomFields.jsx       Custom field editors
│   │   ├── DrawerDescription.jsx        Markdown editor/viewer
│   │   ├── DrawerChecklist.jsx          Checklist with progress
│   │   ├── DrawerSubtasks.jsx           Child task list
│   │   ├── DrawerDependencies.jsx       Dependency links
│   │   ├── DrawerAttachments.jsx        File list + upload
│   │   ├── DrawerTimeLog.jsx            Time entries + log button
│   │   ├── DrawerComments.jsx           Comment thread
│   │   ├── DrawerActivity.jsx           Change history
│   │   └── DrawerAcceptanceCriteria.jsx Acceptance criteria checklist
│   │
│   ├── sprint/
│   │   ├── SprintHeader.jsx             Active sprint info bar
│   │   ├── SprintSelector.jsx           Sprint dropdown navigator
│   │   ├── SprintCreateModal.jsx        New sprint form
│   │   ├── SprintCompleteDialog.jsx     Complete sprint with options
│   │   ├── SprintBacklog.jsx            Below-board backlog section
│   │   ├── BurndownChart.jsx            Sprint burndown
│   │   ├── BurnupChart.jsx              Sprint burnup
│   │   └── VelocityChart.jsx            Multi-sprint velocity trend
│   │
│   ├── analytics/
│   │   ├── BoardAnalyticsPanel.jsx      Expandable stats panel
│   │   ├── BoardStatCards.jsx           Total, In Progress, Blocked, Cycle Time
│   │   ├── CumulativeFlowDiagram.jsx   Stacked area chart
│   │   ├── CycleTimeChart.jsx           Cycle time histogram
│   │   ├── ThroughputChart.jsx          Completed per week
│   │   ├── AgingWorkIndicator.jsx       Card aging dot
│   │   └── WipUtilizationBar.jsx        Per-column WIP usage
│   │
│   ├── views/
│   │   ├── ListView.jsx                 Table view component
│   │   ├── ListViewRow.jsx              Single row
│   │   ├── ListViewColumnConfig.jsx     Show/hide/reorder columns
│   │   ├── CalendarView.jsx             Monthly calendar
│   │   ├── CalendarDayCell.jsx          Single day with task chips
│   │   ├── TimelineView.jsx             Gantt chart
│   │   ├── TimelineBar.jsx              Task duration bar
│   │   ├── TimelineDependencyArrow.jsx  Arrow between linked tasks
│   │   └── ViewSwitcher.jsx             Board/List/Calendar/Timeline toggle
│   │
│   ├── templates/
│   │   ├── BoardTemplateGallery.jsx     Template browser
│   │   ├── BoardTemplateCard.jsx        Template preview card
│   │   ├── BoardApplyWizard.jsx         2-step apply wizard
│   │   ├── ColumnConfigStep.jsx         Column customization step
│   │   ├── StatusCompatibilityCheck.jsx Status mapping validator
│   │   └── SaveAsBoardTemplate.jsx      Save current board as template
│   │
│   ├── settings/
│   │   ├── BoardSettingsGeneral.jsx     Name, description, type, icon
│   │   ├── BoardSettingsColumns.jsx     Column CRUD with drag reorder
│   │   ├── BoardSettingsSwimlanes.jsx   Swimlane configuration
│   │   ├── BoardSettingsCardLayout.jsx  Toggle card field visibility
│   │   ├── BoardSettingsFilters.jsx     Manage quick filters
│   │   ├── BoardSettingsAutomations.jsx Column-level automation rules
│   │   └── BoardSettingsAging.jsx       Aging thresholds
│   │
│   └── shared/
│       ├── CreateTaskModal.jsx          Quick task creation
│       ├── CreateTaskInline.jsx         Inline "add task" at column bottom
│       ├── BoardBreadcrumb.jsx          Project > Board navigation
│       └── BoardTabBar.jsx              Board tabs within project
│
└── hooks/
    ├── useBoard.js                     Fetch single board with columns
    ├── useBoards.js                    Fetch all boards for a project
    ├── useBoardTasks.js                Fetch tasks for board, organized by column
    ├── useDragDrop.js                  Drag-and-drop state and handlers
    ├── useBoardFilters.js              Filter state management
    ├── useBoardAnalytics.js            Fetch analytics data
    ├── useBoardWebSocket.js            Real-time event subscription
    ├── useBoardMutations.js            Board CRUD mutations
    ├── useColumnMutations.js           Column CRUD mutations
    ├── useTaskMove.js                  Task move mutation with optimistic UI
    ├── useSwimlanes.js                 Compute swimlane groupings
    ├── useBoardTemplates.js            Fetch/apply board templates
    └── useSavedFilters.js              Saved filter CRUD
```

---

## 34. Keyboard Shortcuts & Accessibility

### 34.1 Board Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `N` | New task (opens create modal) |
| `F` | Focus search / filter bar |
| `/` | Focus search |
| `1-9` | Jump to column by number |
| `←` / `→` | Navigate between columns (when card selected) |
| `↑` / `↓` | Navigate between cards in a column |
| `Enter` | Open selected card in drawer |
| `Esc` | Close drawer / clear selection |
| `Space` | Toggle card selection (for multi-select) |
| `Ctrl+D` | Duplicate selected task |
| `A` | Assign selected task to me |
| `P` | Change priority of selected task |
| `S` | Change status of selected task |
| `L` | Toggle labels on selected task |
| `Ctrl+F` | Open advanced filters |
| `Ctrl+Shift+F` | Clear all filters |
| `G then B` | Go to board list |
| `G then S` | Go to board settings |

### 34.2 Accessibility

- All interactive elements have ARIA labels
- Drag-and-drop has keyboard alternative: select card → use arrow keys → `Ctrl+Enter` to drop
- Column WIP status announced to screen readers
- High contrast mode support (respects `prefers-contrast`)
- Focus trapping in modals and drawers
- Color is never the only indicator — always paired with icons, text, or patterns

---

*This document is the complete specification for the Nexora Boards module. Every template, API, schema, and component is defined to developer-handoff quality. Boards connect to Projects (workflow, team, settings), Tasks (cards, movement), Sprints (scrum boards), and Templates (creation from pre-built patterns).*
