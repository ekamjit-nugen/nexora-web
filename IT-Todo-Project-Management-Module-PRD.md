# Product Requirements Document
## Project Management & Agile Delivery Module
### For IT Todo — Full-Stack Team Productivity Platform

---

| | |
|---|---|
| **Document Version** | 1.0 |
| **Author** | Varun S. (CTO) |
| **Organization** | Nugen IT Services |
| **Date** | March 26, 2026 |
| **Status** | Draft |
| **Classification** | Internal — Engineering |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Data Architecture](#2-data-architecture)
3. [Methodology Templates](#3-methodology-templates)
4. [Feature Specifications](#4-feature-specifications)
5. [Cross-Module Integration with IT Todo](#5-cross-module-integration-with-it-todo)
6. [API Specification](#6-api-specification)
7. [Database Indexes & Performance](#7-database-indexes--performance)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Success Metrics & KPIs](#10-success-metrics--kpis)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Appendix](#12-appendix)

---

## 1. Executive Summary

This PRD defines the complete feature specification for the **Project Management & Agile Delivery Module** within the IT Todo platform. The module enables teams to plan, track, and deliver software projects using industry-standard methodologies including Scrum, Kanban, SAFe, Waterfall, Extreme Programming, Lean, Scrumban, and fully customizable workflows.

The module is designed to serve as a central hub for project execution with hierarchical work item management (Epic → Story → Task → Subtask), dependency-aware scheduling, intelligent story point-to-time estimation, multi-view boards, sprint lifecycle management, and deep integration with IT Todo's existing HR, attendance, and payroll modules.

### 1.1 Business Objectives

- Eliminate dependency on third-party tools (Jira, Asana, Trello) for IT Todo customers
- Provide methodology-agnostic project management that adapts to any team's workflow
- Deliver intelligent estimation through velocity learning and dependency-aware critical path analysis
- Enable cross-module integration: link project effort to HR timesheets, attendance, and billing
- Support multi-project, multi-team environments with role-based access control

### 1.2 Target Users

| User Role | Primary Use Cases | Access Level |
|---|---|---|
| CTO / Tech Lead | Project creation, methodology selection, velocity review, resource allocation | Owner / Admin |
| Project Manager | Sprint planning, backlog grooming, burndown monitoring, stakeholder reporting | Admin |
| Developer | Task pickup, status updates, time logging, dependency tracking | Member |
| QA Engineer | Bug reporting, test case linking, regression tracking | Member |
| Designer | Story review, design task management, handoff tracking | Member |
| HR Manager | Timesheet reconciliation, resource utilization reports | Viewer / Reports |
| Client / Stakeholder | Progress dashboards, milestone tracking, read-only boards | Viewer |

### 1.3 Tech Stack Alignment

This module integrates with IT Todo's existing stack:

- **Frontend:** React.js with Next.js, Tailwind CSS
- **Backend:** Node.js with Express.js REST API
- **Database:** MongoDB (document model aligns naturally with hierarchical work items)
- **AI Integration:** Claude API for intelligent estimation, sprint recommendations, and natural language task creation
- **Local LLM:** Qwen2.5-Coder via Ollama for privacy-sensitive operations (HR data, salary-linked estimations)
- **Infrastructure:** AWS/Azure deployment with real-time WebSocket updates

---

## 2. Data Architecture

The module uses a hierarchical document model in MongoDB. Every entity references its parent and project, enabling efficient queries at any level of the hierarchy.

### 2.1 Entity Hierarchy

```
Workspace → Project → Board → Sprint → Epic → Story/Feature → Task/Bug → Subtask
```

Each level inherits permissions and configuration from its parent. A user configures once at the project level and everything flows down.

### 2.2 Core Data Models

#### 2.2.1 Project

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Auto | Unique identifier |
| `name` | String | Yes | Project display name |
| `slug` | String | Auto | URL-safe unique identifier |
| `methodology` | Enum | Yes | `scrum` \| `kanban` \| `scrumban` \| `safe` \| `waterfall` \| `xp` \| `lean` \| `custom` |
| `description` | String | No | Project overview text (Markdown supported) |
| `ownerId` | ObjectId (ref: User) | Yes | Project owner |
| `members` | Array[{userId, role}] | Yes | Team members with access levels |
| `columns` | Array[{name, wipLimit, color}] | Yes | Board column configuration |
| `pointScale` | Array[Number] | Yes | Fibonacci or custom: `[1,2,3,5,8,13,21]` |
| `workTypes` | Array[{name, icon, color, allowedChildren}] | Yes | Work item type definitions |
| `sprintDuration` | Number \| null | No | Sprint length in days (null for continuous flow) |
| `hoursPerPoint` | Number | Yes | Baseline estimation ratio, default `4.0` |
| `velocityHistory` | Array[{sprintId, pointsCompleted, actualHours}] | Auto | Rolling velocity data |
| `automationRules` | Array[AutomationRule] | No | Trigger-action automation configurations |
| `tags` | Array[String] | No | Project-level tag library |
| `status` | Enum | Yes | `active` \| `archived` \| `completed` |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last modification timestamp |

#### 2.2.2 WorkItem (Unified Model)

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Auto | Unique identifier |
| `projectId` | ObjectId (ref: Project) | Yes | Parent project |
| `sprintId` | ObjectId (ref: Sprint) \| null | No | Assigned sprint (null = backlog) |
| `parentId` | ObjectId (ref: WorkItem) \| null | No | Parent item for hierarchy (null = top-level) |
| `type` | Enum | Yes | `Epic` \| `Feature` \| `Story` \| `Task` \| `Bug` \| `Subtask` \| `Enabler` \| etc. |
| `title` | String | Yes | Item title, max 255 chars |
| `description` | String | No | Rich text description (Markdown) |
| `status` | String | Yes | Maps to board column name |
| `priority` | Enum | Yes | `Critical` \| `High` \| `Medium` \| `Low` |
| `storyPoints` | Number | No | Estimation in story points from project's scale |
| `estimatedHours` | Number | Auto | Calculated: `storyPoints × project.hoursPerPoint` |
| `actualHours` | Number | No | Logged hours from time tracking |
| `assigneeId` | ObjectId (ref: User) \| null | No | Assigned team member |
| `reporterId` | ObjectId (ref: User) | Yes | Creator of the item |
| `dependencies` | Array[{itemId, type}] | No | Dependency relationships |
| `tags` | Array[String] | No | Labels/tags for filtering |
| `attachments` | Array[{fileId, name, type}] | No | Linked files |
| `comments` | Array[{userId, text, createdAt}] | No | Discussion thread |
| `activityLog` | Array[{action, userId, timestamp, details}] | Auto | Full audit trail |
| `order` | Number | Yes | Sort position within column/sprint |
| `dueDate` | DateTime \| null | No | Target completion date |
| `completedAt` | DateTime \| null | Auto | Timestamp when moved to Done |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last modification |

#### 2.2.3 Sprint

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Auto | Unique identifier |
| `projectId` | ObjectId (ref: Project) | Yes | Parent project |
| `name` | String | Yes | Sprint name (e.g., Sprint 14) |
| `goal` | String | No | Sprint goal statement |
| `startDate` | DateTime | Yes | Sprint start |
| `endDate` | DateTime | Yes | Sprint end |
| `status` | Enum | Yes | `planning` \| `active` \| `review` \| `completed` |
| `plannedPoints` | Number | Auto | Sum of item points at sprint start |
| `completedPoints` | Number | Auto | Sum of completed item points |
| `burndownData` | Array[{day, remaining, ideal}] | Auto | Daily burndown snapshots |
| `velocity` | Number | Auto | Points completed in this sprint |
| `retroNotes` | String | No | Retrospective notes (Markdown) |
| `carryOverItems` | Array[ObjectId] | Auto | Items auto-moved to next sprint |

#### 2.2.4 Dependency Model

Dependencies between work items use a Directed Acyclic Graph (DAG) structure stored on each item:

| Dependency Type | Code | Behavior | Board Impact |
|---|---|---|---|
| Blocked By | `blocks` | Item cannot move forward until blocker is Done | Card dimmed with BLOCKED badge, drag restricted |
| Relates To | `relates` | Soft link for context, no blocking | Link shown in detail modal only |
| Duplicates | `duplicates` | Marks item as duplicate of another | Warning badge, auto-close when original resolves |
| Is Child Of | `child_of` | Hierarchical parent-child | Nested display, parent progress bar |

The system validates the DAG on every dependency creation to prevent circular references. A topological sort computes the critical path for sprint delivery date calculation.

---

## 3. Methodology Templates

Each template pre-configures board columns, sprint settings, work item types, point scales, WIP limits, and key practices. Templates are forkable — teams can use a built-in template, modify it over 2–3 sprints, and save their customized version as a new template.

### 3.1 Template Specifications

#### 3.1.1 Scrum

| Property | Configuration |
|---|---|
| **Columns** | Backlog → Sprint Ready → In Progress → In Review → Done |
| **Sprint Duration** | 14 days (configurable: 7, 14, 21, 28) |
| **Point Scale** | Fibonacci: 1, 2, 3, 5, 8, 13, 21 |
| **Work Types** | Epic, Story, Task, Bug, Subtask |
| **Ceremonies** | Sprint Planning, Daily Standup, Sprint Review, Retrospective |
| **Key Features** | Velocity tracking, burndown charts, sprint goals, backlog grooming view |

#### 3.1.2 Kanban

| Property | Configuration |
|---|---|
| **Columns** | Inbox → Ready → Doing → Review → Shipped |
| **Sprint Duration** | None (continuous flow) |
| **Point Scale** | 1, 2, 3, 5, 8 |
| **Work Types** | Task, Bug, Improvement, Subtask |
| **WIP Limits** | Doing: 4, Review: 2 (configurable per column) |
| **Key Features** | Cumulative flow diagram, cycle time analytics, lead time tracking, WIP alerts |

#### 3.1.3 SAFe (Scaled Agile Framework)

| Property | Configuration |
|---|---|
| **Columns** | Funnel → Analyzing → Implementing → Validating → Deployed |
| **Sprint Duration** | 14 days (within 8–12 week Program Increments) |
| **Point Scale** | Fibonacci: 1, 2, 3, 5, 8, 13, 21 |
| **Work Types** | Epic, Feature, Story, Enabler, Bug |
| **Ceremonies** | PI Planning, ART Sync, Inspect & Adapt, Innovation Sprint |
| **Key Features** | Program board, feature-level tracking, capacity allocation across teams, PI objectives |

#### 3.1.4 Waterfall

| Property | Configuration |
|---|---|
| **Columns** | Requirements → Design → Development → Testing → Deployment |
| **Sprint Duration** | None (phase-gated) |
| **Point Scale** | 1, 2, 3, 5, 8, 13 |
| **Work Types** | Milestone, Deliverable, Task, Defect |
| **Key Features** | Phase gate sign-offs, change control board, Gantt chart view, critical path display |

#### 3.1.5 Extreme Programming (XP)

| Property | Configuration |
|---|---|
| **Columns** | Stories → Planned → Coding → Testing → Released |
| **Sprint Duration** | 7 days (1-week iterations) |
| **Point Scale** | 1, 2, 3, 5, 8 |
| **Work Types** | Story, Task, Bug, Spike |
| **Practices** | Pair Programming, TDD, Continuous Integration, Refactoring |
| **Key Features** | Pair assignment, TDD checklist per task, CI build status integration, refactoring tracker |

#### 3.1.6 Lean Startup

| Property | Configuration |
|---|---|
| **Columns** | Idea → Validated → Building → Measuring → Learned |
| **Sprint Duration** | None (continuous) |
| **Point Scale** | 1, 2, 3, 5 |
| **Work Types** | Hypothesis, Experiment, Task, Bug |
| **Key Features** | Build-Measure-Learn cycle tracker, hypothesis validation scores, pivot/persevere decisions |

#### 3.1.7 Scrumban

| Property | Configuration |
|---|---|
| **Columns** | Backlog → Ready → In Progress → Testing → Done |
| **Sprint Duration** | 14 days (cadence-based, not commitment-based) |
| **Point Scale** | 1, 2, 3, 5, 8, 13 |
| **Work Types** | Epic, Story, Task, Bug, Subtask |
| **WIP Limits** | In Progress: 5 (configurable) |
| **Key Features** | Sprint cadence with WIP limits, on-demand planning triggers, hybrid metrics |

#### 3.1.8 Custom Board

| Property | Configuration |
|---|---|
| **Columns** | To Do → In Progress → Done (fully customizable) |
| **Sprint Duration** | 14 days (configurable or disabled) |
| **Point Scale** | 1, 2, 3, 5, 8, 13 (customizable) |
| **Work Types** | Epic, Story, Task, Bug, Subtask (customizable) |
| **Key Features** | Full control over all settings — build your own methodology from scratch |

---

## 4. Feature Specifications

### 4.1 Hierarchical Work Items

Work items follow a strict parent-child hierarchy with enforced type constraints. The system prevents invalid nesting (e.g., a Task cannot be parent of an Epic).

#### 4.1.1 Hierarchy Rules

| Parent Type | Allowed Children | Max Depth |
|---|---|---|
| Epic | Story, Feature, Enabler | Level 1 |
| Feature | Story, Enabler | Level 1 |
| Story | Task, Bug, Subtask | Level 2 |
| Task | Subtask | Level 3 |
| Milestone | Deliverable, Task | Level 1 |
| Hypothesis | Experiment, Task | Level 1 |

#### 4.1.2 Parent Item Behaviors

- **Progress bar:** Parent items display a progress bar showing (children in Done column / total children)
- **Point rollup:** Parent's total points can be auto-calculated as sum of children, or manually set
- **Status propagation:** When all children move to Done, system prompts to move parent to Done
- **Cascade delete:** Deleting a parent offers options to delete children, move children to backlog, or cancel
- **Expand/collapse:** Board cards and list rows are expandable to show nested children inline

#### 4.1.3 Work Item Creation Flows

**Quick Create:** A persistent input bar at the top of every view. User types a title, presses Enter, and the item is created in the first column with default type/priority. User can fill details later.

**Full Create Modal:** Accessed via the `+ Create` button. Includes all fields: title, type, priority, story points (with visual picker), parent selector (filtered by hierarchy rules), assignee, dependency, tags, due date, and description.

**Bulk Create:** Paste CSV/TSV data to create multiple items at once. System auto-maps columns by header name. Supports import from Jira CSV export, Trello JSON export, and Asana CSV export.

**AI Create:** Natural language input via Claude API integration. User types "Create a story for implementing OAuth login with Google, 8 points, assign to Priya, blocked by the auth module epic" and the system creates the item with all fields populated.

### 4.2 Board & Display Views

The module offers 8 distinct views, each optimized for a different workflow need. All views share the same filter/search toolbar and support drag-and-drop where applicable.

| View | Best For | Key Capabilities |
|---|---|---|
| **Board (Kanban)** | Daily work tracking, standups | Drag-and-drop columns, WIP limit warnings, expandable cards, swimlane grouping |
| **List** | Bulk operations, data-dense review | Sortable/filterable table, inline editing, multi-select bulk actions, CSV export |
| **Hierarchy** | Backlog grooming, epic breakdown | Tree view with expand/collapse, parent-child links, completion counts, color-coded type bars |
| **Timeline (Gantt)** | Sprint planning, deadline tracking | Horizontal bars sized by points, dependency arrows, milestone markers, drag-to-resize |
| **Swimlane** | Cross-cutting analysis | Columns grouped by type, assignee, or priority; each lane has its own column set |
| **WBS (Work Breakdown)** | Scope definition, stakeholder view | Nested indented tree with connecting lines, rollup summaries at each level |
| **Calendar** | Due date management, release planning | Month/week/day views, items plotted by due date, drag to reschedule |
| **Dashboard** | Status reporting, velocity review | Burndown chart, velocity trend, cumulative flow, member workload heatmap |

#### 4.2.1 Board View Details

- **Columns:** Configured per methodology template; each column has a name, optional WIP limit, and color accent
- **Drag-and-drop:** Items can be dragged between columns. Dependency checks run on drop — if a blocker isn't Done, the drop is rejected with a toast notification
- **Expandable cards:** Click the expand arrow on a parent item to see children inline within the column
- **Swimlanes:** Toggle grouping by type, assignee, priority, or sprint to create horizontal lanes across columns
- **Column actions:** Click column header for quick filters, collapse column, or set WIP limit
- **Card density:** Toggle between compact (title + type + assignee only) and detailed (full card with points, tags, progress) modes

#### 4.2.2 Dashboard View Details

- **Sprint burndown:** Line chart comparing ideal burndown (linear) vs. actual remaining points, updated daily
- **Velocity chart:** Bar chart showing points completed per sprint over the last 6–10 sprints with trend line
- **Cumulative flow diagram:** Stacked area chart showing item counts per column over time (Kanban methodology)
- **Member workload:** Horizontal stacked bars per team member showing their assigned points by status
- **Bug trend:** Line chart tracking open bugs over time, with severity breakdown
- **Cycle time distribution:** Histogram showing how many days items take to move from first active column to Done

### 4.3 Sprint Lifecycle Management

Sprints follow a four-phase lifecycle: **Plan → Execute → Review → Retro**. Each phase has distinct UI states and automation triggers.

#### 4.3.1 Sprint Planning Phase

1. **Sprint creation:** PM sets sprint name, goal, start/end dates. System calculates capacity based on team size and historical velocity.
2. **Backlog grooming:** Drag items from the Backlog column into the Sprint Ready column. System shows running total of planned points vs. team capacity.
3. **Capacity warning:** When planned points exceed 110% of average velocity, a warning banner appears with recommended scope reduction.
4. **Sprint commitment:** PM confirms the sprint scope. Items in Sprint Ready become locked to this sprint.

#### 4.3.2 Sprint Execution Phase

- **Active board:** Standard Kanban board with only sprint-scoped items visible
- **Daily burndown:** Auto-updated at midnight based on remaining points in non-Done columns
- **Mid-sprint scope change:** Adding/removing items from an active sprint requires Admin role and is logged in the activity trail
- **Blocker alerts:** Items blocked for more than 24 hours trigger notifications to the assignee and PM

#### 4.3.3 Sprint Review Phase

- **Sprint closure:** PM triggers sprint close. System calculates actual velocity (points in Done column).
- **Velocity recalculation:** The project's `hoursPerPoint` ratio is updated using weighted moving average:
  ```
  new_ratio = (0.5 × current_sprint) + (0.3 × previous_sprint) + (0.2 × sprint_before_that)
  ```
- **Carry-over:** Incomplete items are auto-moved to the next sprint (or back to backlog, configurable per project)
- **Sprint report:** Auto-generated summary showing planned vs. delivered, velocity trend, and carry-over items

#### 4.3.4 Sprint Retrospective Phase

- **Retro board:** Built-in "What Went Well / What Didn't / Action Items" template
- **Action items become work items:** Convert any retro action item into a Task in the next sprint with one click
- **Historical retros:** All retrospective notes are saved and searchable for pattern identification across sprints

### 4.4 Story Point Estimation Engine

The estimation engine provides intelligent time predictions based on story points, using a three-layer approach that improves with each sprint.

#### 4.4.1 Layer 1: Baseline Calibration

- Each project starts with a configurable baseline ratio (default: 1 story point = 4 hours)
- Teams can adjust this during onboarding based on their historical data from other tools
- The baseline is used for all estimations until the first sprint completes

#### 4.4.2 Layer 2: Velocity Learning

After each sprint closes, the system recalculates the hours-per-point ratio:

**Formula:**
```
new_ratio = (0.5 × last_sprint_ratio) + (0.3 × prev_sprint_ratio) + (0.2 × oldest_sprint_ratio)
```

- The weighted moving average gives more influence to recent sprints while smoothing outliers
- Per-member velocity is also tracked to enable member-specific estimation when an item is assigned
- Estimation accuracy score: System tracks predicted hours vs. actual hours and displays an accuracy percentage on the dashboard

#### 4.4.3 Layer 3: Dependency-Aware Critical Path

The system builds a DAG from all dependency relationships and computes the critical path:

1. **Topological sort:** All items are sorted respecting dependency order
2. **Parallel path detection:** Items without mutual dependencies are identified as parallelizable
3. **Critical path calculation:** The longest sequential chain of dependent items determines the minimum delivery time
4. **Slack time:** Non-critical items show their float (how much they can slip without affecting the critical path)
5. **Delivery date projection:** Sprint end date is compared against critical path duration to flag at-risk sprints

#### 4.4.4 AI-Assisted Estimation

Integration with Claude API for estimation assistance:

- **Story point suggestion:** When creating an item, Claude analyzes the title and description against historical items in the project and suggests a point value with confidence score
- **Effort decomposition:** For large items (13+ points), Claude suggests a breakdown into smaller stories/tasks
- **Risk flagging:** Claude identifies items that historically take longer than estimated based on their tags, type, and assigned member's velocity

### 4.5 Dependency & Blocking System

#### 4.5.1 Dependency Types

| Type | Behavior | Visual Indicator | Board Constraint |
|---|---|---|---|
| Blocked By | Hard block — item cannot advance until blocker is in Done column | Red BLOCKED badge on card, red line in dependency graph | Drag rejected with toast: "Blocked by: [item title]" |
| Relates To | Soft link — informational, no constraints | Link icon in detail modal | None |
| Duplicates | Item is a copy of another | Yellow DUPLICATE badge | Auto-close prompt when original resolves |
| Is Child Of | Hierarchical nesting | Indent in hierarchy view, nested in board cards | Child inherits parent's sprint assignment |

#### 4.5.2 Dependency Graph Visualization

- **Interactive node graph:** Items as nodes, dependencies as directed edges. Blocked chains highlighted in red.
- **Critical path overlay:** Toggle to highlight the longest dependency chain in the current sprint
- **Cycle detection:** Real-time validation prevents circular dependencies. If A blocks B and user tries to make B block A, the system rejects with a clear error message
- **Impact analysis:** Clicking any item shows all downstream dependents — useful for assessing the blast radius of a delay

### 4.6 Automation Rules Engine

Project admins can define trigger-action rules that automate repetitive workflow actions. Rules are evaluated in real-time on every item state change.

#### 4.6.1 Available Triggers

| Trigger | Fires When |
|---|---|
| Status changed | Item moves to a specific column |
| All children done | Every child item of a parent reaches Done |
| Sprint started | Sprint status changes to active |
| Sprint ended | Sprint end date is reached or sprint is manually closed |
| Item created | A new work item is created of a specific type |
| Assignee changed | Item is assigned or reassigned |
| Points exceeded | Sprint total exceeds velocity threshold |
| Blocked duration | Item has been blocked for N hours |
| Due date approaching | Item's due date is within N days |

#### 4.6.2 Available Actions

| Action | Effect |
|---|---|
| Move item | Change item's column/status |
| Assign to | Set or change item assignee |
| Send notification | Push notification, email, or Slack message to specified users |
| Add tag | Apply a tag to the item |
| Create item | Auto-create a linked item (e.g., create QA task when story moves to Review) |
| Update field | Change any item field value |
| Trigger webhook | POST to external URL with item payload |

#### 4.6.3 Pre-built Automation Templates

- **Auto-advance parent:** When all children are Done → move parent to In Review
- **Sprint cleanup:** When sprint ends → move incomplete items to next sprint backlog
- **Bug triage alert:** When Bug with Critical priority is created → notify Tech Lead
- **Review reminder:** When item is In Review for 24+ hours → notify reviewer
- **Capacity guard:** When sprint points exceed 110% velocity → notify PM with warning
- **Auto-assign QA:** When Story moves to In Review → create linked QA Task assigned to QA team

### 4.7 Role-Based Access Control

Access control is defined at the project level and inherits down to all items. Roles integrate with IT Todo's existing HR employee directory.

| Role | Create Items | Edit Items | Move Items | Manage Sprints | Manage Members | Delete Project | View Reports |
|---|---|---|---|---|---|---|---|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Member** | ✅ | Own only | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Viewer** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 4.8 Search, Filter & Sort

A unified toolbar available across all views provides:

- **Full-text search:** Searches title, description, tags, and comments. Results are highlighted and ranked by relevance.
- **Filters:** Type, priority, assignee, sprint, status/column, tags, date range (created, updated, due). Filters are combinable with AND logic.
- **Saved filters:** Users can save frequently used filter combinations as named presets (e.g., "My Critical Bugs")
- **Sort:** By priority, points, due date, created date, last updated, assignee name. Ascending/descending toggle.
- **Group by:** Type, assignee, priority, sprint, tag — works in both List and Board views
- **Bulk actions:** Multi-select items in List view to bulk-move, bulk-assign, bulk-tag, or bulk-delete

### 4.9 Notifications & Activity Feeds

- **In-app notification center:** Bell icon with unread count, grouped by project
- **Email digest:** Configurable daily/weekly summary of project activity
- **Real-time updates:** WebSocket-powered live board updates when other team members move items
- **Activity feed per item:** Full audit trail showing who changed what and when
- **Mentions:** @mention team members in comments to trigger targeted notifications
- **Slack integration:** Optional webhook to post sprint start/end, blocker alerts, and completion milestones to Slack channels

---

## 5. Cross-Module Integration with IT Todo

### 5.1 HR Module Integration

| Integration Point | Data Flow | Behavior |
|---|---|---|
| Employee directory | HR → PM | Team member dropdown pulls from active employees. New hires auto-appear; terminated employees are flagged. |
| Department mapping | HR → PM | Project teams can be auto-populated from HR department/team structure |
| Onboarding checklists | PM → HR | Auto-create onboarding task board when new employee is added in HR module |
| Skill matrix | HR → PM | AI estimation considers team member's skill tags when suggesting assignments |

### 5.2 Attendance Module Integration

| Integration Point | Data Flow | Behavior |
|---|---|---|
| Check-in status | Attendance → PM | Board shows green/gray dots on avatars for checked-in vs. absent members |
| Leave calendar | Attendance → PM | Sprint capacity auto-adjusts when team members have approved leave during sprint dates |
| Overtime tracking | PM → Attendance | Hours logged on tasks beyond standard hours are flagged for overtime policy review |

### 5.3 Payroll & Billing Integration

| Integration Point | Data Flow | Behavior |
|---|---|---|
| Timesheet sync | PM → Payroll | Actual hours logged on tasks populate employee timesheets automatically |
| Client billing | PM → Billing | Story points/hours per project feed into client-facing billing reports |
| Cost per story point | Payroll → PM | Dashboard shows cost-per-point metric using hourly rates from payroll (via Qwen local LLM for data privacy) |

### 5.4 AI Integration Architecture

The module uses a dual-LLM approach for different sensitivity levels:

| Operation | LLM | Rationale |
|---|---|---|
| Story point estimation | Claude API | Requires broad knowledge of software engineering patterns |
| Task decomposition | Claude API | Needs understanding of technical architecture |
| Natural language task creation | Claude API | Best-in-class instruction following |
| Sprint report generation | Claude API | Complex summarization from multiple data sources |
| Cost-per-point calculation | Qwen (local via Ollama) | Involves salary data — must stay on-premise |
| HR-linked capacity planning | Qwen (local via Ollama) | Uses employee PII and HR records |
| Timesheet reconciliation | Qwen (local via Ollama) | Cross-references payroll-sensitive data |

---

## 6. API Specification

RESTful API built on Express.js with JWT authentication. All endpoints return JSON. Real-time updates via WebSocket (Socket.IO).

### 6.1 Core Endpoints

#### Projects

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/projects` | Create a new project with methodology template | Owner |
| `GET` | `/api/projects` | List all projects for authenticated user | Any |
| `GET` | `/api/projects/:id` | Get project details with board configuration | Member+ |
| `PATCH` | `/api/projects/:id` | Update project settings | Admin+ |
| `DELETE` | `/api/projects/:id` | Archive project (soft delete) | Owner |

#### Work Items

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/projects/:id/items` | Create work item | Member+ |
| `GET` | `/api/projects/:id/items` | List items with filters, pagination, sorting | Member+ |
| `GET` | `/api/projects/:id/items/:itemId` | Get item details with children and dependencies | Member+ |
| `PATCH` | `/api/projects/:id/items/:itemId` | Update item fields | Member+ (own) / Admin+ |
| `DELETE` | `/api/projects/:id/items/:itemId` | Delete item (with cascade options) | Admin+ |
| `POST` | `/api/projects/:id/items/:itemId/move` | Move item to column (with dependency validation) | Member+ |
| `POST` | `/api/projects/:id/items/bulk` | Bulk create/update/delete items | Admin+ |

#### Sprints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/projects/:id/sprints` | Create sprint | Admin+ |
| `GET` | `/api/projects/:id/sprints` | List sprints with status | Member+ |
| `PATCH` | `/api/projects/:id/sprints/:sprintId` | Update sprint (start, close, edit) | Admin+ |
| `GET` | `/api/projects/:id/sprints/:sprintId/burndown` | Get burndown data | Member+ |
| `POST` | `/api/projects/:id/sprints/:sprintId/close` | Close sprint with carry-over | Admin+ |

#### Dependencies

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/projects/:id/dependencies` | Get full dependency graph | Member+ |
| `POST` | `/api/projects/:id/dependencies` | Create dependency (with cycle validation) | Member+ |
| `GET` | `/api/projects/:id/critical-path` | Compute and return critical path | Member+ |

#### Analytics & AI

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/projects/:id/analytics/velocity` | Velocity trend data | Member+ |
| `GET` | `/api/projects/:id/analytics/cumulative-flow` | Cumulative flow data | Member+ |
| `GET` | `/api/projects/:id/analytics/cycle-time` | Cycle time distribution | Member+ |
| `POST` | `/api/projects/:id/ai/estimate` | AI-powered story point estimation | Member+ |
| `POST` | `/api/projects/:id/ai/decompose` | AI-powered task decomposition | Member+ |

### 6.2 WebSocket Events

| Event | Direction | Payload | Trigger |
|---|---|---|---|
| `item:moved` | Server → Client | `{itemId, fromCol, toCol, userId}` | Item dragged to new column |
| `item:updated` | Server → Client | `{itemId, changes, userId}` | Any item field change |
| `item:created` | Server → Client | `{item, userId}` | New item created |
| `sprint:started` | Server → Client | `{sprintId}` | Sprint activated |
| `sprint:closed` | Server → Client | `{sprintId, velocity, carryOver}` | Sprint completed |
| `member:status` | Server → Client | `{userId, online}` | Team member goes online/offline |

---

## 7. Database Indexes & Performance

Critical compound indexes for query performance on the WorkItem collection:

| Index | Fields | Purpose |
|---|---|---|
| Board query | `{projectId: 1, sprintId: 1, status: 1, order: 1}` | Primary board load — all items for a sprint grouped by column |
| Hierarchy | `{projectId: 1, parentId: 1, type: 1}` | Fetch children of any item efficiently |
| Assignee view | `{projectId: 1, assigneeId: 1, status: 1}` | Member workload and filtered views |
| Dependency lookup | `{projectId: 1, "dependencies.itemId": 1}` | Dependency graph construction |
| Search | `{projectId: 1, title: "text", description: "text"}` | Full-text search within a project |
| Timeline | `{projectId: 1, dueDate: 1, createdAt: 1}` | Calendar and timeline view queries |
| Activity | `{projectId: 1, updatedAt: -1}` | Recent activity feed, sorted newest first |

---

## 8. Implementation Roadmap

The module is broken into 5 phases, each delivering a usable increment. Total estimated timeline: **14–18 weeks**.

### 8.1 Phase 1: Foundation (Weeks 1–3)

| Deliverable | Story Points | Priority |
|---|---|---|
| Project CRUD with methodology template selection | 8 | P0 |
| Work item CRUD with type/priority/points | 8 | P0 |
| Board view with drag-and-drop columns | 13 | P0 |
| List view with sort/filter | 8 | P0 |
| Basic parent-child hierarchy (1 level) | 5 | P0 |
| User authentication and project-level RBAC | 8 | P0 |
| MongoDB schema and core indexes | 5 | P0 |

**Phase 1 Total: 55 story points**

### 8.2 Phase 2: Sprint Engine (Weeks 4–6)

| Deliverable | Story Points | Priority |
|---|---|---|
| Sprint CRUD with lifecycle states | 8 | P0 |
| Sprint planning view (backlog → sprint) | 8 | P0 |
| Burndown chart (daily auto-update) | 5 | P1 |
| Velocity calculation and history tracking | 8 | P0 |
| Hours-per-point recalculation engine | 5 | P0 |
| Sprint closure with carry-over logic | 5 | P1 |
| Retrospective notes per sprint | 3 | P2 |

**Phase 2 Total: 42 story points**

### 8.3 Phase 3: Advanced Features (Weeks 7–10)

| Deliverable | Story Points | Priority |
|---|---|---|
| Full dependency system (4 types + DAG validation) | 13 | P0 |
| Critical path calculation and visualization | 8 | P1 |
| Deep hierarchy (3 levels with rollup) | 8 | P1 |
| Hierarchy view | 5 | P1 |
| Timeline/Gantt view with dependency arrows | 8 | P1 |
| Swimlane view | 5 | P1 |
| WBS view | 5 | P2 |
| Calendar view | 5 | P2 |
| Dashboard view with charts (Recharts/Chart.js) | 13 | P1 |
| WebSocket real-time board sync | 8 | P1 |

**Phase 3 Total: 78 story points**

### 8.4 Phase 4: Intelligence & Automation (Weeks 11–14)

| Deliverable | Story Points | Priority |
|---|---|---|
| Automation rules engine (triggers + actions) | 13 | P1 |
| Pre-built automation templates | 5 | P1 |
| Claude API: story point estimation | 8 | P1 |
| Claude API: natural language task creation | 8 | P1 |
| Claude API: task decomposition | 5 | P2 |
| Qwen local: cost-per-point calculations | 5 | P2 |
| Notification system (in-app + email) | 8 | P1 |
| Mention system in comments | 3 | P2 |
| Bulk import (Jira CSV, Trello JSON, Asana CSV) | 8 | P1 |

**Phase 4 Total: 63 story points**

### 8.5 Phase 5: Integration & Polish (Weeks 15–18)

| Deliverable | Story Points | Priority |
|---|---|---|
| HR module integration (employee directory, departments) | 8 | P1 |
| Attendance module integration (capacity, leave calendar) | 8 | P1 |
| Payroll integration (timesheet sync, billing) | 8 | P2 |
| Slack webhook integration | 5 | P2 |
| Saved filters and custom views | 5 | P2 |
| Template forking (save customized methodology) | 5 | P2 |
| Mobile-responsive board optimization | 8 | P1 |
| Performance optimization and load testing | 5 | P1 |
| End-to-end testing and QA | 8 | P0 |

**Phase 5 Total: 60 story points**

---

### Total Effort Summary

| Phase | Weeks | Story Points | Engineering Hours (@ 4h/pt) |
|---|---|---|---|
| Phase 1: Foundation | 1–3 | 55 | 220 |
| Phase 2: Sprint Engine | 4–6 | 42 | 168 |
| Phase 3: Advanced Features | 7–10 | 78 | 312 |
| Phase 4: Intelligence & Automation | 11–14 | 63 | 252 |
| Phase 5: Integration & Polish | 15–18 | 60 | 240 |
| **Grand Total** | **18 weeks** | **298 points** | **1,192 hours** |

---

## 9. Non-Functional Requirements

### 9.1 Performance

| Metric | Target | Measurement |
|---|---|---|
| Board load time | < 500ms | Time to render all items in active sprint (up to 200 items) |
| Drag-and-drop latency | < 100ms | Time from drop to visual confirmation |
| Search response | < 300ms | Full-text search across all project items |
| WebSocket propagation | < 200ms | Time for other clients to see a board change |
| API response (95th percentile) | < 400ms | All core CRUD operations |
| Dashboard chart render | < 1s | Burndown, velocity, and CFD with 6 months of data |

### 9.2 Scalability

- Support 50+ concurrent projects per workspace
- Handle 10,000+ work items per project without performance degradation
- Scale to 100+ simultaneous board users via WebSocket connection pooling
- MongoDB sharding strategy: shard key = `projectId` for horizontal scaling

### 9.3 Security

- JWT-based authentication with refresh token rotation
- Project-level RBAC enforced at API middleware layer (not just UI)
- Rate limiting: 100 requests/minute per user, 1000/minute per project
- Input sanitization: XSS prevention on all text fields, especially Markdown descriptions
- Audit log: All CRUD operations logged with userId, timestamp, and IP address
- Data encryption: AES-256 at rest for attachment storage, TLS 1.3 in transit
- Sensitive data routing: Salary and PII data processed exclusively via local Qwen instance

### 9.4 Availability & Reliability

- Target uptime: 99.9% (allowing ~8.7 hours downtime per year)
- Database: MongoDB replica set with 3 nodes for automatic failover
- Graceful degradation: If WebSocket disconnects, board falls back to polling every 5 seconds
- Data backup: Automated daily backups with 30-day retention
- Disaster recovery: RPO < 1 hour, RTO < 4 hours

---

## 10. Success Metrics & KPIs

| Metric | Target (3 months post-launch) | Measurement Method |
|---|---|---|
| Module adoption rate | 60% of active IT Todo users create at least 1 project | Database query: distinct users with project ownership |
| Active board usage | 40% daily active rate among project members | Board view loads per user per day |
| Sprint completion rate | 70%+ of planned points delivered per sprint | Average across all active sprints |
| Estimation accuracy | Within 20% of actual hours after 3 sprints | (predicted hours − actual hours) / predicted hours |
| Tool consolidation | 30% of users discontinue separate PM tool subscriptions | Post-launch user survey |
| Cross-module engagement | 25% of projects link to HR/attendance data | Database query: projects with cross-module references |
| AI feature usage | 50% of items created use AI estimation or NL creation | API call logs for `/ai/*` endpoints |

---

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Feature overload delays MVP | High | Medium | Strict P0/P1/P2 prioritization. Phase 1–2 are the MVP; Phases 3–5 are incremental. |
| Performance degradation with large datasets | High | Low | Compound indexes, pagination defaults, lazy loading for hierarchy expansion |
| WebSocket scaling challenges | Medium | Medium | Redis pub/sub adapter for Socket.IO. Connection pooling with sticky sessions. |
| AI estimation inaccuracy | Medium | Medium | AI suggestions are never auto-applied; always human-confirmed. Accuracy tracking surfaces poor predictions. |
| Cross-module integration complexity | Medium | High | Integration via internal REST APIs with clear contracts. Phase 5 has dedicated integration testing sprint. |
| Local LLM latency on constrained hardware | Low | Medium | Async processing queue for Qwen operations. Results cached for 24h. Graceful fallback to manual entry. |

---

## 12. Appendix

### 12.1 Glossary

| Term | Definition |
|---|---|
| **Story Point** | Abstract unit of effort/complexity used in agile estimation. Not a direct time measure. |
| **Velocity** | Total story points completed per sprint. Used to predict capacity for future sprints. |
| **WIP Limit** | Work-In-Progress limit. Maximum number of items allowed in a Kanban column simultaneously. |
| **DAG** | Directed Acyclic Graph. Data structure used to model dependencies without circular references. |
| **Critical Path** | The longest chain of dependent items that determines the minimum project delivery time. |
| **Burndown** | Chart showing remaining work (story points) over time during a sprint. |
| **CFD** | Cumulative Flow Diagram. Stacked area chart showing item counts per status over time. |
| **PI** | Program Increment. A timebox (typically 8–12 weeks) used in SAFe methodology. |
| **ART** | Agile Release Train. A team-of-teams concept in SAFe for large-scale coordination. |
| **Spike** | A time-boxed research task used in XP/Agile to reduce uncertainty before estimation. |

### 12.2 Reference Documents

- IT Todo Platform Architecture Document (internal)
- IT Todo HR Module PRD (internal)
- IT Todo Attendance Module PRD (internal)
- Scrum Guide 2020 (scrumguides.org)
- Kanban Guide for Scrum Teams (scrum.org)
- SAFe 6.0 Framework Reference (scaledagileframework.com)
- MongoDB Schema Design Patterns (mongodb.com)

### 12.3 Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | March 26, 2026 | Varun S. | Initial PRD creation with complete feature specification |

---

*Confidential — Nugen IT Services — Internal Engineering Use Only*
