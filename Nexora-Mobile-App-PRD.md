# Nexora — Mobile App PRD

## Overview

A cross-platform mobile app (React Native / Expo) providing essential day-to-day functionality for all Nexora users. The app focuses on **high-frequency, time-sensitive actions** — things people need on the go — not full feature parity with the web app.

**Philosophy**: The mobile app is a companion to the web, not a replacement. Admin-heavy workflows (role management, policy creation, org settings) stay web-only.

---

## Tech Stack

| Layer | Tech | Reason |
|---|---|---|
| Framework | React Native + Expo SDK 52+ | Shared codebase, OTA updates, fast iteration |
| Navigation | Expo Router (file-based) | Mirrors Next.js app router patterns |
| State | Zustand + React Query | Lightweight global state + server state caching |
| UI | React Native Paper or Tamagui | Material Design / cross-platform components |
| Auth | Secure Store (Expo) | Token storage (not AsyncStorage) |
| Push | Expo Notifications + FCM/APNs | Real-time alerts |
| Biometrics | expo-local-authentication | FaceID / fingerprint for quick unlock |
| API | Same API Gateway (localhost:3005 / prod URL) | No new backend needed |

---

## User Roles & Feature Matrix

### Feature Availability by Role

| Feature | Employee | Developer / Designer | Manager | HR | Admin |
|---|---|---|---|---|---|
| **Dashboard** | Own stats | Own stats | Team stats | Org stats | Org stats |
| **Clock In/Out** | Yes | Yes | Yes | Yes | No (admin restriction) |
| **View Attendance** | Own | Own | Team | All | All |
| **Approve Attendance** | — | — | — | Yes | Yes |
| **Apply Leave** | Yes | Yes | Yes | Yes | Yes |
| **Approve Leave** | — | — | — | Yes | Yes |
| **View Leave Balance** | Own | Own | Own | Own | Own |
| **View Projects** | Assigned | Assigned | Managed | View all | View all |
| **View Tasks** | Assigned | Assigned + create/edit | Assigned + assign | View all | View all |
| **Log Time** | Own tasks | Own tasks | Own tasks | — | — |
| **Chat** | Yes | Yes | Yes | Yes | Yes |
| **Calls** | Yes | Yes | Yes | Yes | Yes |
| **Directory** | View | View | View | View + edit | View + edit |
| **Notifications** | Yes | Yes | Yes | Yes | Yes |
| **Profile / Settings** | Yes | Yes | Yes | Yes | Yes |
| **Invoices** | — | — | View | View + create | View + create |
| **Clients** | — | — | View | View + edit | View + edit |

---

## App Screens & Navigation

### Bottom Tab Navigation (5 tabs)

```
[ Home ]  [ Time ]  [ Work ]  [ Chat ]  [ More ]
```

| Tab | Icon | Primary Screen |
|---|---|---|
| **Home** | LayoutGrid | Dashboard |
| **Time** | Clock | Attendance + Leaves |
| **Work** | Briefcase | Projects + Tasks |
| **Chat** | MessageCircle | Conversations |
| **More** | Menu | Directory, Settings, etc. |

---

### Screen Breakdown

#### 1. Home Tab — Dashboard

**All users see:**
- Greeting with name + avatar
- Today's attendance status (clocked in / not yet / day off)
- Quick action buttons: Clock In, Apply Leave, Log Time
- Upcoming leaves (next 7 days)
- Recent notifications (last 5)

**Manager+ see additionally:**
- Team attendance summary (present / absent / on leave)
- Pending approvals count (badge)

**HR/Admin see additionally:**
- Org-level stats cards (total employees, on leave today, avg attendance %)

---

#### 2. Time Tab — Attendance & Leaves

**Sub-tabs:** `Attendance` | `Leaves`

##### Attendance Screen

| Element | Description |
|---|---|
| **Clock In/Out Button** | Large, prominent. Shows current status (Clocked In since 9:15 AM / Not Clocked In) |
| **Today's Sessions** | List of clock-in/out pairs for today |
| **Duration** | Running timer showing hours worked today vs expected |
| **History** | Calendar view → tap date → see attendance details |
| **Manual Entry** (if needed) | Form: date, clock-in time, clock-out time, reason |

**Manager/HR/Admin:** Additional "Team" sub-tab showing team attendance for today.

**HR/Admin:** "Approvals" sub-tab for pending manual entry approvals.

##### Leaves Screen

| Element | Description |
|---|---|
| **Balance Cards** | Horizontal scroll of leave type balances (Casual: 8/12, Sick: 10/12, etc.) |
| **Apply Leave Button** | Modal: leave type, from date, to date, reason, half-day toggle |
| **My Leaves** | List of applied leaves with status badges (Pending / Approved / Rejected) |
| **Cancel** | Swipe-to-cancel on pending leaves |

**HR/Admin:** "Approvals" sub-tab for pending leave requests with approve/reject actions.

---

#### 3. Work Tab — Projects & Tasks

**Sub-tabs:** `Projects` | `Tasks` | `Timesheets`

##### Projects Screen

| Element | Description |
|---|---|
| **Project List** | Cards: project name, status badge, progress %, team avatars |
| **Search + Filter** | By status (active, completed, on hold) |
| **Tap → Detail** | Overview, team, recent tasks |

##### Tasks Screen

| Element | Description |
|---|---|
| **Task List** | Grouped by status (To Do, In Progress, Done) |
| **Filters** | Project, assignee, priority, status |
| **Task Card** | Title, project name, priority badge, assignee avatar, due date |
| **Tap → Detail** | Description, comments, time entries, status change |
| **Quick Actions** | Change status (swipe), log time (tap timer icon) |

**Developer/Designer:** Can create new tasks from this screen.
**Manager:** Can assign/reassign tasks.

##### Timesheets Screen

| Element | Description |
|---|---|
| **Weekly View** | Mon-Sun with hours per day |
| **Log Time** | Tap a day → select project/task → enter hours |
| **Submit** | Submit weekly timesheet for approval |
| **Status** | Draft / Submitted / Approved / Rejected |

---

#### 4. Chat Tab

| Element | Description |
|---|---|
| **Conversation List** | Recent conversations, unread badges, last message preview |
| **Search** | Search conversations and messages |
| **New Chat** | Start direct message or group chat |
| **Chat Screen** | Messages, reply, reactions, image/file sharing |
| **Call Button** | Voice/video call from chat (integrates with calling service) |

**Push notifications** for new messages when app is backgrounded.

---

#### 5. More Tab

| Item | Description | Role Gate |
|---|---|---|
| **Profile** | View/edit name, avatar, phone | All |
| **Directory** | Employee cards, search | All (edit: HR/Admin) |
| **Clients** | Client list | Manager/HR/Admin |
| **Invoices** | Invoice list, create | HR/Admin |
| **Notifications** | Full notification history | All |
| **Settings** | Theme, notification preferences | All |
| **Organization** | Org info, switch org | All |
| **About** | App version, support link | All |
| **Logout** | Sign out | All |

---

## Key Mobile-Specific Features

### 1. Geolocation Clock-In (Optional)

- Org admins can enable "location-required" for clock-in
- App captures lat/lng at clock-in/out
- Shows on attendance record (web admin can verify)
- No tracking while clocked in — only at clock-in/out moment

**Backend change:** Add optional `location: { lat, lng, accuracy }` to attendance check-in/out DTO.

### 2. Push Notifications

| Event | Recipients | Priority |
|---|---|---|
| Leave approved/rejected | Applicant | High |
| New leave request | Approvers (HR/Admin) | Medium |
| Manual attendance pending | HR/Admin | Medium |
| Task assigned | Assignee | Medium |
| Task status changed | Project members | Low |
| New chat message | Recipient | High |
| Incoming call | Callee | Critical |
| Timesheet approved/rejected | Submitter | Medium |
| Clock-in reminder | Employee (configurable) | Medium |

**Backend change:** New notification-service (or extend existing services) to send push via FCM/APNs using device tokens.

### 3. Biometric Authentication

- After initial OTP login, enable FaceID/fingerprint
- Quick unlock without re-entering OTP
- Auto-lock after 5 minutes inactive
- "Remember device" for 30 days

### 4. Offline Support (Limited)

| Feature | Offline Behavior |
|---|---|
| Dashboard | Show cached data with "Last updated" timestamp |
| Clock In/Out | Queue action, sync when online |
| View Attendance | Cached history |
| View Tasks | Cached task list |
| Chat | Show cached messages, queue outgoing |
| Apply Leave | Queue, sync when online |

Uses React Query's persistence + background sync.

### 5. Widgets (iOS/Android)

- **Attendance Widget**: Clock in/out button + hours worked today
- **Leave Balance Widget**: Quick view of remaining balances

---

## Backend Changes Required

### New: Notification Service

A lightweight service for managing push notifications.

| Endpoint | Method | Description |
|---|---|---|
| `/notifications/device` | POST | Register device token (FCM/APNs) |
| `/notifications/device` | DELETE | Unregister device token |
| `/notifications/preferences` | GET/PUT | Notification preferences |
| `/notifications` | GET | Notification history (paginated) |
| `/notifications/:id/read` | PUT | Mark as read |
| `/notifications/read-all` | PUT | Mark all as read |

**Schema: DeviceToken**
```typescript
{
  userId: String,
  organizationId: String,
  token: String,        // FCM/APNs token
  platform: 'ios' | 'android',
  deviceName: String,
  lastActive: Date
}
```

**Schema: Notification**
```typescript
{
  userId: String,
  organizationId: String,
  type: String,         // 'leave_approved', 'task_assigned', etc.
  title: String,
  body: String,
  data: Mixed,          // Deep link info: { screen: 'task', id: '...' }
  isRead: Boolean,
  createdAt: Date
}
```

### Existing Service Changes

| Service | Change |
|---|---|
| **Attendance** | Add optional `location` field to check-in/out |
| **Auth** | Add device token management endpoints |
| **All services** | Emit events for notification triggers (leave approved, task assigned, etc.) |

### API Gateway

No changes — mobile app uses the same gateway (`/api/v1/*`).

---

## Navigation Flow

```
App Launch
├── Has valid token + biometric? → Biometric unlock → Home
├── Has valid token? → Home
└── No token → Login (OTP)
    ├── Single org → Home
    └── Multiple orgs → Org Selection → Home

Home Tab
├── Dashboard
├── Quick Actions → Clock In, Apply Leave, Log Time
└── Notifications → Notification List

Time Tab
├── Attendance
│   ├── Clock In/Out
│   ├── History (Calendar)
│   ├── Manual Entry
│   └── Team View (Manager+)
│       └── Approvals (HR/Admin)
└── Leaves
    ├── Balance Cards
    ├── Apply Leave
    ├── My Leaves
    └── Approvals (HR/Admin)

Work Tab
├── Projects
│   └── Project Detail
│       ├── Overview
│       ├── Team
│       └── Tasks
├── Tasks
│   └── Task Detail
│       ├── Comments
│       ├── Time Entries
│       └── Status Change
└── Timesheets
    ├── Weekly View
    ├── Log Time
    └── Submit

Chat Tab
├── Conversation List
├── Chat Screen
│   ├── Messages
│   ├── Reply
│   └── Call
└── New Chat

More Tab
├── Profile
├── Directory
│   └── Employee Detail
├── Clients (Manager+)
├── Invoices (HR/Admin)
├── Notifications
├── Settings
│   ├── Appearance
│   └── Notification Preferences
├── Organization
│   └── Switch Org
└── Logout
```

---

## Platform Admin Mobile Access

If the user is a `platform_admin` (see Platform Super Admin PRD):

- **Home tab** shows platform-wide stats instead of org stats
- **More tab** includes "Platform" section: Organizations list, All Users
- Organization management (suspend/activate) available
- No org-private data access (same restrictions as web)
- Audit log viewable but not the primary interface (web preferred)

---

## Screen Priority for MVP

### Phase 1 — Core (Must Have)

| Screen | Justification |
|---|---|
| Login (OTP) | Entry point |
| Org Selection | Multi-org support |
| Dashboard | Daily overview |
| Clock In/Out | #1 daily action |
| Attendance History | Check records |
| Apply Leave | Common need on-the-go |
| Leave Balance | Quick reference |
| Task List + Detail | Check assigned work |
| Chat + Messages | Communication |
| Push Notifications | Timely alerts |
| Profile | Basic settings |

### Phase 2 — Extended

| Screen | Justification |
|---|---|
| Leave Approvals | Manager/HR workflow |
| Attendance Approvals | HR workflow |
| Project List + Detail | Project visibility |
| Timesheets | Time logging |
| Directory | Find colleagues |
| Biometric Auth | Convenience |
| Geolocation Clock-In | Attendance verification |

### Phase 3 — Full Feature

| Screen | Justification |
|---|---|
| Clients | Sales/management |
| Invoices | Finance on-the-go |
| Video/Voice Calls | Communication |
| Offline Support | Reliability |
| Widgets | Quick access |
| Platform Admin views | Platform management |

---

## Project Structure

```
nexora-mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── select-org.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Bottom tab navigator
│   │   ├── index.tsx             # Home/Dashboard
│   │   ├── time/
│   │   │   ├── _layout.tsx       # Tab header with sub-tabs
│   │   │   ├── attendance.tsx
│   │   │   └── leaves.tsx
│   │   ├── work/
│   │   │   ├── _layout.tsx
│   │   │   ├── projects.tsx
│   │   │   ├── tasks.tsx
│   │   │   └── timesheets.tsx
│   │   ├── chat/
│   │   │   └── index.tsx
│   │   └── more/
│   │       └── index.tsx
│   ├── project/[id].tsx          # Project detail
│   ├── task/[id].tsx             # Task detail
│   ├── chat/[id].tsx             # Chat conversation
│   ├── profile.tsx
│   ├── directory.tsx
│   ├── settings.tsx
│   └── notifications.tsx
├── components/
│   ├── ui/                       # Shared UI components
│   ├── attendance/               # Clock-in button, history, etc.
│   ├── leaves/                   # Balance cards, apply form
│   ├── tasks/                    # Task card, filters
│   └── chat/                     # Message bubble, input
├── lib/
│   ├── api.ts                    # API client (shared logic with web)
│   ├── auth.ts                   # Token management (SecureStore)
│   ├── notifications.ts          # Push notification setup
│   └── store.ts                  # Zustand stores
├── app.json                      # Expo config
├── eas.json                      # EAS Build config
└── package.json
```

---

## Design Guidelines

| Aspect | Guideline |
|---|---|
| **Theme** | Match web app's theming (user preferences from backend) |
| **Typography** | System fonts (SF Pro on iOS, Roboto on Android) for performance |
| **Colors** | Same HSL primary system, respect dark mode preference |
| **Touch Targets** | Minimum 44x44pt |
| **Loading States** | Skeleton screens, not spinners |
| **Error States** | Inline error messages with retry |
| **Empty States** | Illustrated empty states with action prompts |
| **Haptics** | Light haptic on clock-in/out, task status change |
| **Animations** | Subtle — shared element transitions, spring physics |

---

## Success Metrics

| Metric | Target |
|---|---|
| Daily active users (mobile) | 60% of total active users |
| Clock-in via mobile | 70% of all clock-ins |
| App crash rate | < 0.5% |
| Cold start time | < 2 seconds |
| Push notification opt-in | > 80% |
| Offline action sync success | > 99% |
