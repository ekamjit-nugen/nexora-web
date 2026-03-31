# Nexora Projects Module — Market Readiness Implementation Plan

**Version:** 2.0  
**Date:** 2026-03-31  
**Target:** Production-ready Jira alternative with competitive differentiation  
**Timeline:** 8 weeks (4 waves × 2 weeks each)  
**Simulation Org:** **PixelCraft Studios** — 18-member game development studio  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Simulation Organization Profile](#simulation-organization-profile)
3. [Wave-by-Wave Implementation Plan](#wave-by-wave-implementation-plan)
   - [Wave 1: Security & Core Stability](#wave-1-security--core-stability-weeks-1-2)
   - [Wave 2: Collaboration & Board Usability](#wave-2-collaboration--board-usability-weeks-3-4)
   - [Wave 3: Advanced Project Management](#wave-3-advanced-project-management-weeks-5-6)
   - [Wave 4: Reporting & Market Differentiators](#wave-4-reporting--market-differentiators-weeks-7-8)
4. [Beyond Jira: Competitive Differentiators](#beyond-jira-competitive-differentiators)
5. [Testing Strategy & Simulation Plan](#testing-strategy--simulation-plan)
6. [Daily Usage Simulation Scripts](#daily-usage-simulation-scripts)
7. [Acceptance Criteria Matrix](#acceptance-criteria-matrix)
8. [Pain Point Resolution Map](#pain-point-resolution-map)

---

## Executive Summary

### Current State
- **Adoption Readiness:** 5.0/10
- **Critical Blockers:** 7 P0 issues
- **High-Priority Gaps:** 11 P1 issues
- **Security Risk:** XSS vulnerability via localStorage

### Target State (Post-Wave 4)
- **Adoption Readiness:** 8.5/10
- **All P0/P1 gaps resolved**
- **3 competitive differentiators vs Jira**
- **Production-ready for 50+ person organizations**

### Resource Allocation
- **Backend:** 2 senior developers
- **Frontend:** 2 senior developers + 1 mid-level
- **QA:** 1 automation engineer + 1 manual tester
- **DevOps:** 0.5 FTE (security hardening, deployment)

---

## Simulation Organization Profile

### PixelCraft Studios Pvt. Ltd.

**Industry:** Game Development (Mobile + PC)  
**Team Size:** 18 members  
**Location:** Bangalore, India  
**Current Tools:** Jira (3 years), Confluence, Slack, Figma  
**Pain Points with Jira:**
1. **Expensive** — $7/user/month × 18 = $126/month = ₹10,500/month (₹1.26L/year)
2. **Slow** — Atlassian cloud performance issues in India (300-500ms latency)
3. **Over-engineered** — 80% of features unused, overwhelming for new hires
4. **No built-in time tracking** — needs third-party Tempo Timesheets ($5/user/month extra)
5. **No integrated client portal** — client feedback scattered across email/WhatsApp
6. **Weak mobile app** — designers and artists can't update tasks on the go
7. **No visual asset preview** — game design tasks require external Figma/Miro links

### Team Roster

| # | Name | Role | Jira Experience | Key Workflows |
|---|------|------|-----------------|---------------|
| 1 | **Aditya Malhotra** | Founder & Game Director | 5 years | Sprint planning, client reviews |
| 2 | **Kavya Rao** | Engineering Lead | 4 years | Architecture, technical debt tracking |
| 3 | **Rohan Deshmukh** | Senior Unity Developer | 3 years | Feature implementation, code reviews |
| 4 | **Shreya Pillai** | Unity Developer | 2 years | Gameplay mechanics, bug fixes |
| 5 | **Arjun Nambiar** | Backend Developer (Node.js) | 3 years | API development, database design |
| 6 | **Isha Kapoor** | Frontend Developer (React) | 2 years | UI implementation, state management |
| 7 | **Vikram Joshi** | Mobile Developer (React Native) | 2 years | Cross-platform mobile features |
| 8 | **Naina Sharma** | QA Lead | 4 years | Test planning, automation, regression |
| 9 | **Kunal Mehta** | QA Engineer | 1 year | Manual testing, bug reporting |
| 10 | **Priya Iyer** | Lead Game Designer | 3 years | Level design, game mechanics design |
| 11 | **Sanjay Reddy** | Game Designer | 2 years | Economy balancing, progression design |
| 12 | **Meera Jain** | UI/UX Designer | 3 years | UI mockups, user flows, prototypes |
| 13 | **Tanvi Gupta** | 2D Artist | 2 years | Character art, UI assets |
| 14 | **Rahul Agarwal** | 3D Artist | 3 years | Environment modeling, animation |
| 15 | **Pooja Menon** | DevOps Engineer | 2 years | CI/CD, cloud infrastructure |
| 16 | **Nikhil Verma** | Product Manager | 5 years | Roadmap, stakeholder management |
| 17 | **Anjali Shetty** | Scrum Master | 3 years | Sprint facilitation, retrospectives |
| 18 | **Maya Chen** | Client (DreamGames Corp) | N/A | Feedback, milestone approvals |

### Active Projects

| Project | Key | Type | Methodology | Team Size | Current Sprint |
|---------|-----|------|-------------|-----------|----------------|
| Dragon Quest Mobile | DQM | Mobile Game | Scrum (2-week) | 12 | Sprint 23 |
| Website Redesign | WEB | Marketing | Kanban | 3 | N/A |
| Internal Tools | INT | Platform | Scrum (1-week) | 3 | Sprint 8 |

---

## Wave-by-Wave Implementation Plan

---

## Wave 1: Security & Core Stability (Weeks 1-2)

### Objective
Eliminate all P0 blockers and critical security vulnerabilities. Make the platform safe and stable for production use.

### Features to Implement

#### 1.1 Security Hardening

**1.1.1 JWT Token Migration (httpOnly Cookies)**

**Backend Changes:**
```javascript
// services/auth-service/src/middleware/auth.js
// BEFORE (VULNERABLE):
res.json({ token, user });

// AFTER (SECURE):
res.cookie('nexora_token', token, {
  httpOnly: true,        // Not accessible to JavaScript
  secure: true,          // HTTPS only
  sameSite: 'strict',    // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/'
});
res.json({ user }); // No token in response body
```

**Frontend Changes:**
```javascript
// Remove all localStorage.setItem('token') calls
// Remove all Authorization headers (cookies sent automatically)
// Update axios config:
axios.defaults.withCredentials = true;
```

**API Changes:**
```
POST /api/auth/login
  Response: Set-Cookie header (no token in body)
  
POST /api/auth/logout
  Response: Clear cookie via Set-Cookie with maxAge=0
  
GET /api/auth/refresh
  Request: Cookie sent automatically
  Response: New cookie if valid, 401 if expired
```

**Testing:**
- [ ] XSS attack simulation (inject malicious script, verify token inaccessible)
- [ ] CSRF protection verification
- [ ] Cross-domain cookie behavior
- [ ] Logout token invalidation
- [ ] Token refresh flow

---

**1.1.2 Frontend RBAC Route Guards**

**Implementation:**
```javascript
// frontend/src/utils/rbac.js
const PERMISSIONS = {
  'admin': ['*'], // All permissions
  'manager': [
    'project:create', 'project:edit', 'project:delete',
    'sprint:create', 'sprint:edit', 'sprint:delete',
    'task:create', 'task:edit', 'task:delete',
    'task:bulk_update', 'board:configure'
  ],
  'member': [
    'task:create', 'task:edit_own', 'task:comment',
    'board:view', 'sprint:view'
  ],
  'viewer': [
    'project:view', 'task:view', 'board:view'
  ]
};

export const can = (user, permission, resource = null) => {
  const role = user.role;
  const perms = PERMISSIONS[role] || [];
  
  if (perms.includes('*')) return true;
  if (perms.includes(permission)) {
    // Check resource ownership for edit_own
    if (permission.endsWith('_own') && resource) {
      return resource.createdBy === user.id || 
             resource.assignee === user.id;
    }
    return true;
  }
  return false;
};
```

**Route Guard:**
```javascript
// frontend/src/routes/ProtectedRoute.jsx
<Route
  path="/projects/new"
  element={
    <RequirePermission permission="project:create">
      <NewProjectPage />
    </RequirePermission>
  }
/>
```

**Component-Level Guards:**
```jsx
// Hide buttons based on permissions
{can(currentUser, 'task:delete', task) && (
  <button onClick={handleDelete}>Delete Task</button>
)}
```

**Testing:**
- [ ] Audit all 47 frontend routes for permission checks
- [ ] Test each role against permission matrix
- [ ] Verify UI elements hidden for unauthorized roles
- [ ] Verify API returns 403 when frontend bypassed

---

#### 1.2 Sprint Completion Flow

**1.2.1 Sprint Close Modal UI**

**Component:**
```jsx
// SprintCompleteModal.jsx
<Modal>
  <h2>Complete Sprint: {sprint.name}</h2>
  
  <SummarySection>
    <Stat label="Completed" value={completedCount} color="green" />
    <Stat label="Incomplete" value={incompleteCount} color="orange" />
    <Stat label="Total Points" value={totalPoints} />
    <Stat label="Completed Points" value={completedPoints} />
    <Stat label="Velocity" value={completedPoints} />
  </SummarySection>
  
  {incompleteItems.length > 0 && (
    <IncompleteItemsSection>
      <h3>What should we do with incomplete items?</h3>
      <RadioGroup value={destination} onChange={setDestination}>
        <Radio value="backlog">Move to Backlog</Radio>
        <Radio value="next_sprint">Move to Next Sprint (if exists)</Radio>
        <Radio value="new_sprint">Create New Sprint and Move</Radio>
      </RadioGroup>
      
      <ItemsList>
        {incompleteItems.map(item => (
          <ItemCard key={item.id}>
            <span>{item.key}</span>
            <span>{item.title}</span>
            <Checkbox 
              label="Keep in this sprint (mark complete)"
              checked={item.forceComplete}
              onChange={() => toggleForceComplete(item.id)}
            />
          </ItemCard>
        ))}
      </ItemsList>
    </IncompleteItemsSection>
  )}
  
  <Actions>
    <Button onClick={onCancel}>Cancel</Button>
    <Button primary onClick={handleComplete}>
      Complete Sprint
    </Button>
  </Actions>
</Modal>
```

**Backend Endpoint:**
```javascript
// POST /api/projects/:projectId/sprints/:sprintId/complete
{
  incompleteAction: 'backlog' | 'next_sprint' | 'new_sprint',
  newSprintName?: string,      // if incompleteAction = 'new_sprint'
  forceCompleteIds?: string[], // items to mark done anyway
}

Response:
{
  success: true,
  sprint: { ...completedSprint },
  movedItems: [...],
  newSprint: { ... }, // if created
  velocity: 42
}
```

**Testing:**
- [ ] Complete sprint with all items done
- [ ] Complete sprint with incomplete items → backlog
- [ ] Complete sprint → create new sprint
- [ ] Complete sprint → move to existing next sprint
- [ ] Force-complete selected items during close
- [ ] Verify velocity calculation
- [ ] Verify sprint status change (active → closed)

---

#### 1.3 Reporter Field & Audit Trail

**Database Schema Update:**
```javascript
// Task schema addition
{
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // User who created the task
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // Person responsible for completing it
  }
}
```

**Frontend Task Form:**
```jsx
<Field label="Reporter">
  <UserPicker
    value={task.reporter}
    disabled // Auto-filled with current user
  />
</Field>

<Field label="Assignee">
  <UserPicker
    value={task.assignee}
    onChange={setAssignee}
    options={projectMembers}
  />
</Field>
```

**Migration Script:**
```javascript
// Set reporter = createdBy for all existing tasks
db.tasks.updateMany(
  { reporter: { $exists: false } },
  [{ $set: { reporter: "$createdBy" } }]
);
```

**Testing:**
- [ ] Create task → reporter auto-filled with current user
- [ ] Verify reporter immutable after creation
- [ ] Verify reporter shown in task detail
- [ ] Verify reporter filterable in search
- [ ] Test migration script on staging data

---

#### 1.4 Burndown & Velocity Chart Frontend

**Burndown Chart Component:**
```jsx
// BurndownChart.jsx using Chart.js
import { Line } from 'react-chartjs-2';

const BurndownChart = ({ sprintId }) => {
  const { data, loading } = useFetch(`/api/sprints/${sprintId}/burndown`);
  
  const chartData = {
    labels: data.dates, // ['Day 1', 'Day 2', ...]
    datasets: [
      {
        label: 'Ideal Burndown',
        data: data.idealBurndown,
        borderColor: 'rgba(200, 200, 200, 0.8)',
        borderDash: [5, 5],
      },
      {
        label: 'Actual Burndown',
        data: data.actualBurndown,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      }
    ]
  };
  
  return <Line data={chartData} options={...} />;
};
```

**Velocity Chart Component:**
```jsx
// VelocityChart.jsx
import { Bar } from 'react-chartjs-2';

const VelocityChart = ({ projectId, lastNSprints = 6 }) => {
  const { data } = useFetch(
    `/api/projects/${projectId}/velocity?limit=${lastNSprints}`
  );
  
  const chartData = {
    labels: data.sprints.map(s => s.name),
    datasets: [
      {
        label: 'Committed Points',
        data: data.sprints.map(s => s.committedPoints),
        backgroundColor: 'rgba(156, 163, 175, 0.5)',
      },
      {
        label: 'Completed Points',
        data: data.sprints.map(s => s.completedPoints),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      }
    ]
  };
  
  return <Bar data={chartData} options={...} />;
};
```

**Backend Endpoints:**
```javascript
// GET /api/sprints/:sprintId/burndown
Response: {
  dates: ['2026-03-01', '2026-03-02', ...],
  idealBurndown: [120, 110, 100, 90, ...],
  actualBurndown: [120, 115, 105, 95, ...]
}

// GET /api/projects/:projectId/velocity?limit=6
Response: {
  sprints: [
    {
      name: 'Sprint 20',
      committedPoints: 45,
      completedPoints: 42
    },
    ...
  ],
  averageVelocity: 40.5
}
```

**Testing:**
- [ ] Burndown chart renders with mock data
- [ ] Burndown updates when task status changes
- [ ] Velocity chart shows last 6 sprints
- [ ] Charts responsive on mobile
- [ ] Loading states and empty states handled
- [ ] Data accuracy against database

---

### Wave 1 Success Metrics

| Metric | Target | Validation Method |
|--------|--------|-------------------|
| XSS vulnerability eliminated | 100% | Penetration test |
| RBAC coverage | 100% of routes | Automated test suite |
| Sprint completion flow functional | 100% | Manual QA + automation |
| Reporter field populated | 100% of tasks | Database query |
| Charts rendering | Both charts live | Visual inspection |
| Zero P0 blockers remaining | 0 | Audit checklist |

---

## Wave 2: Collaboration & Board Usability (Weeks 3-4)

### Objective
Transform Nexora into a real-time collaboration platform with best-in-class board UX. Address the #1 complaint from PixelCraft: "We can't collaborate effectively."

### Features to Implement

#### 2.1 @Mentions & Notifications

**2.1.1 @Mention in Comments**

**Frontend Implementation:**
```jsx
// CommentEditor.jsx using react-mentions
import { Mention, MentionsInput } from 'react-mentions';

const CommentEditor = ({ projectMembers, onSubmit }) => {
  const [text, setText] = useState('');
  
  return (
    <MentionsInput
      value={text}
      onChange={e => setText(e.target.value)}
      placeholder="Add a comment... Use @ to mention someone"
    >
      <Mention
        trigger="@"
        data={projectMembers.map(m => ({
          id: m.id,
          display: m.name
        }))}
        renderSuggestion={(entry) => (
          <div className="mention-suggestion">
            <Avatar src={entry.avatar} />
            <span>{entry.display}</span>
          </div>
        )}
      />
    </MentionsInput>
  );
};
```

**Comment Storage:**
```javascript
// MongoDB schema
{
  text: "Hey @[Rohan Deshmukh](user:507f1f77bcf86cd799439011), can you review this?",
  mentions: [
    {
      userId: "507f1f77bcf86cd799439011",
      name: "Rohan Deshmukh",
      position: 4 // Index in text
    }
  ],
  rawText: "Hey @Rohan Deshmukh, can you review this?",
}
```

**Mention Parser (Backend):**
```javascript
// utils/mentionParser.js
const parseMentions = (text) => {
  const regex = /@\[([^\]]+)\]\(user:([a-f0-9]+)\)/g;
  const mentions = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    mentions.push({
      userId: match[2],
      name: match[1],
      position: match.index
    });
  }
  
  return mentions;
};
```

**Testing:**
- [ ] Mention dropdown appears on typing @
- [ ] Selecting user inserts mention
- [ ] Mentions parsed and stored correctly
- [ ] Mentions render as links in comments
- [ ] Multiple mentions in one comment
- [ ] Mention user not in project → validation error

---

**2.1.2 In-App Notification System**

**Database Schema:**
```javascript
// Notification model
{
  userId: ObjectId,          // Recipient
  type: 'mention' | 'assignment' | 'comment' | 'status_change',
  sourceType: 'task' | 'comment' | 'sprint',
  sourceId: ObjectId,
  taskKey: String,           // e.g., "DQM-142"
  message: String,           // "Kavya Rao mentioned you in DQM-142"
  actionUrl: String,         // "/projects/dqm/tasks/DQM-142"
  read: Boolean,
  createdAt: Date,
  actor: {                   // Who triggered the notification
    id: ObjectId,
    name: String,
    avatar: String
  }
}
```

**Notification Creation (Backend):**
```javascript
// services/notification-service/src/handlers/mentionHandler.js
const createMentionNotifications = async (comment) => {
  const mentions = parseMentions(comment.text);
  
  for (const mention of mentions) {
    await Notification.create({
      userId: mention.userId,
      type: 'mention',
      sourceType: 'comment',
      sourceId: comment._id,
      taskKey: comment.task.key,
      message: `${comment.author.name} mentioned you in ${comment.task.key}`,
      actionUrl: `/projects/${comment.task.project}/tasks/${comment.task.key}`,
      actor: {
        id: comment.author._id,
        name: comment.author.name,
        avatar: comment.author.avatar
      }
    });
  }
  
  // Emit real-time notification via WebSocket
  io.to(`user:${mention.userId}`).emit('notification', notification);
};
```

**Frontend Notification Bell:**
```jsx
// NotificationBell.jsx
const NotificationBell = () => {
  const { notifications, unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Popover>
      <PopoverTrigger>
        <IconButton icon={<BellIcon />} badge={unreadCount} />
      </PopoverTrigger>
      
      <PopoverContent>
        <NotificationList>
          {notifications.map(notif => (
            <NotificationItem
              key={notif.id}
              notification={notif}
              onClick={() => {
                markAsRead(notif.id);
                navigate(notif.actionUrl);
              }}
            />
          ))}
        </NotificationList>
        
        <Footer>
          <Button onClick={markAllAsRead}>Mark all as read</Button>
        </Footer>
      </PopoverContent>
    </Popover>
  );
};
```

**Real-Time Updates (WebSocket):**
```javascript
// frontend/src/hooks/useNotifications.js
import io from 'socket.io-client';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const { user } = useAuth();
  
  useEffect(() => {
    const socket = io(process.env.REACT_APP_WS_URL, {
      auth: { userId: user.id }
    });
    
    socket.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      playNotificationSound();
      showBrowserNotification(notification);
    });
    
    return () => socket.disconnect();
  }, [user.id]);
  
  return { notifications, unreadCount };
};
```

**Testing:**
- [ ] Mention triggers notification creation
- [ ] Notification appears in real-time (WebSocket)
- [ ] Bell icon shows unread count
- [ ] Clicking notification navigates to task
- [ ] Mark as read updates UI
- [ ] Mark all as read works
- [ ] Browser notification permission requested
- [ ] Email notification sent (async, 5min delay)

---

#### 2.2 Board Filters & Search

**2.2.1 Filter Bar UI**

**Component:**
```jsx
// BoardFilters.jsx
const BoardFilters = ({ onFilterChange, projectMembers }) => {
  const [filters, setFilters] = useState({
    assignees: [],
    labels: [],
    sprints: [],
    types: [],
    priorities: [],
    searchQuery: ''
  });
  
  return (
    <FilterBar>
      <SearchInput
        placeholder="Search tasks..."
        value={filters.searchQuery}
        onChange={q => updateFilter('searchQuery', q)}
      />
      
      <MultiSelect
        label="Assignee"
        options={projectMembers}
        value={filters.assignees}
        onChange={v => updateFilter('assignees', v)}
      />
      
      <MultiSelect
        label="Labels"
        options={projectLabels}
        value={filters.labels}
        onChange={v => updateFilter('labels', v)}
      />
      
      <MultiSelect
        label="Sprint"
        options={sprints}
        value={filters.sprints}
        onChange={v => updateFilter('sprints', v)}
      />
      
      <MultiSelect
        label="Type"
        options={['Epic', 'Story', 'Task', 'Bug', 'Sub-task']}
        value={filters.types}
        onChange={v => updateFilter('types', v)}
      />
      
      <MultiSelect
        label="Priority"
        options={['Critical', 'High', 'Medium', 'Low']}
        value={filters.priorities}
        onChange={v => updateFilter('priorities', v)}
      />
      
      <Button onClick={clearFilters}>Clear All</Button>
    </FilterBar>
  );
};
```

**Backend Filtering Logic:**
```javascript
// GET /api/boards/:boardId/tasks?filters=...
const getBoardTasks = async (req, res) => {
  const { assignees, labels, sprints, types, priorities, searchQuery } = req.query;
  
  const filter = { boardId: req.params.boardId };
  
  if (assignees) filter.assignee = { $in: assignees.split(',') };
  if (labels) filter.labels = { $in: labels.split(',') };
  if (sprints) filter.sprint = { $in: sprints.split(',') };
  if (types) filter.type = { $in: types.split(',') };
  if (priorities) filter.priority = { $in: priorities.split(',') };
  if (searchQuery) {
    filter.$or = [
      { title: { $regex: searchQuery, $options: 'i' } },
      { description: { $regex: searchQuery, $options: 'i' } },
      { key: { $regex: searchQuery, $options: 'i' } }
    ];
  }
  
  const tasks = await Task.find(filter)
    .populate('assignee reporter')
    .sort({ createdAt: -1 });
  
  res.json({ tasks });
};
```

**Quick Filter Chips:**
```jsx
// Quick access filters
<QuickFilters>
  <Chip onClick={() => setFilter('assignee', currentUser.id)}>
    My Tasks
  </Chip>
  <Chip onClick={() => setFilter('priority', 'High')}>
    High Priority
  </Chip>
  <Chip onClick={() => setFilter('status', 'In Progress')}>
    In Progress
  </Chip>
  <Chip onClick={() => setFilter('dueThisWeek', true)}>
    Due This Week
  </Chip>
</QuickFilters>
```

**Testing:**
- [ ] Filter by single assignee
- [ ] Filter by multiple assignees (OR logic)
- [ ] Filter by labels
- [ ] Filter by sprint (including "No Sprint")
- [ ] Filter by type and priority
- [ ] Search query filters title/description
- [ ] Combine multiple filters (AND logic)
- [ ] Quick filter chips work
- [ ] Clear all filters resets board
- [ ] Filter state persists across page refresh
- [ ] URL params update with filters (shareable links)

---

#### 2.3 Swimlanes

**2.3.1 Swimlane Configuration**

**UI Control:**
```jsx
// Board header
<BoardHeader>
  <Select
    label="Group by"
    value={swimlaneMode}
    onChange={setSwimlaneMode}
  >
    <option value="none">None (flat)</option>
    <option value="assignee">Assignee</option>
    <option value="epic">Epic</option>
    <option value="priority">Priority</option>
    <option value="project">Sub-project</option>
  </Select>
</BoardHeader>
```

**Swimlane Rendering:**
```jsx
// BoardView.jsx
{swimlaneMode === 'assignee' && (
  <SwimlaneContainer>
    {projectMembers.map(member => (
      <Swimlane key={member.id}>
        <SwimlaneHeader>
          <Avatar src={member.avatar} />
          <span>{member.name}</span>
          <Badge>{getTaskCount(member.id)}</Badge>
        </SwimlaneHeader>
        
        <Columns>
          {columns.map(col => (
            <Column key={col.id}>
              <TaskList>
                {getTasksForMemberAndColumn(member.id, col.id).map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </TaskList>
            </Column>
          ))}
        </Columns>
      </Swimlane>
    ))}
    
    {/* Unassigned swimlane */}
    <Swimlane>
      <SwimlaneHeader>Unassigned</SwimlaneHeader>
      <Columns>...</Columns>
    </Swimlane>
  </SwimlaneContainer>
)}
```

**Drag-and-Drop Across Swimlanes:**
```javascript
// Allow drag between swimlanes but auto-update assignee
const handleDrop = (task, targetColumn, targetSwimlane) => {
  // Update column
  updateTask(task.id, { columnId: targetColumn.id });
  
  // Update assignee if swimlane is assignee-based
  if (swimlaneMode === 'assignee') {
    updateTask(task.id, { assignee: targetSwimlane.userId });
  }
};
```

**Testing:**
- [ ] Swimlane by assignee shows all members
- [ ] Swimlane by epic groups correctly
- [ ] Swimlane by priority orders correctly
- [ ] Unassigned swimlane shows unassigned tasks
- [ ] Drag task between swimlanes updates assignee
- [ ] Collapsible swimlanes
- [ ] Empty swimlanes show empty state
- [ ] Swimlane preference saved per board

---

#### 2.4 WIP Limits (Kanban Boards)

**2.4.1 WIP Limit Configuration**

**Board Settings UI:**
```jsx
// BoardSettings.jsx (Kanban only)
<Section title="Work In Progress Limits">
  <p>Set maximum number of tasks allowed in each column.</p>
  
  {columns.map(col => (
    <WipLimitRow key={col.id}>
      <Label>{col.name}</Label>
      <NumberInput
        value={col.wipLimit || ''}
        onChange={v => updateColumnWipLimit(col.id, v)}
        min={0}
        placeholder="No limit"
      />
      <CurrentCount>{getCurrentCount(col.id)} tasks</CurrentCount>
    </WipLimitRow>
  ))}
</Section>
```

**Visual Indicator:**
```jsx
// Column header with WIP indicator
<ColumnHeader>
  <h3>{column.name}</h3>
  <WipIndicator
    current={currentCount}
    limit={column.wipLimit}
    exceeded={currentCount > column.wipLimit}
  >
    {currentCount} / {column.wipLimit || '∞'}
  </WipIndicator>
</ColumnHeader>

{currentCount > column.wipLimit && (
  <Alert severity="warning">
    WIP limit exceeded! Consider moving tasks to Done.
  </Alert>
)}
```

**Drag Validation:**
```javascript
const handleDragOver = (e, targetColumn) => {
  const currentCount = getTaskCount(targetColumn.id);
  const wipLimit = targetColumn.wipLimit;
  
  if (wipLimit && currentCount >= wipLimit) {
    e.dataTransfer.dropEffect = 'none';
    showTooltip('WIP limit reached. Complete some tasks first.');
    return false;
  }
  
  e.dataTransfer.dropEffect = 'move';
  return true;
};
```

**Testing:**
- [ ] Set WIP limit on column
- [ ] WIP indicator shows current/limit
- [ ] Indicator turns red when exceeded
- [ ] Cannot drag task into full column (hard limit option)
- [ ] Warning shown but drag allowed (soft limit option)
- [ ] WIP limit enforcement toggle per board
- [ ] Analytics show WIP violations over time

---

#### 2.5 Additional Task Fields

**2.5.1 Environment, Steps to Reproduce, Acceptance Criteria**

**Task Form UI:**
```jsx
// TaskForm.jsx (conditional fields based on type)
{taskType === 'Bug' && (
  <>
    <Field label="Environment" required>
      <Select value={task.environment} onChange={setEnvironment}>
        <option value="dev">Development</option>
        <option value="staging">Staging</option>
        <option value="production">Production</option>
        <option value="local">Local</option>
      </Select>
    </Field>
    
    <Field label="Steps to Reproduce" required>
      <MarkdownEditor
        value={task.stepsToReproduce}
        onChange={setStepsToReproduce}
        placeholder="1. Navigate to...&#10;2. Click on...&#10;3. Observe..."
      />
    </Field>
    
    <Field label="Expected Behavior">
      <Textarea
        value={task.expectedBehavior}
        onChange={setExpectedBehavior}
        placeholder="What should happen?"
      />
    </Field>
    
    <Field label="Actual Behavior">
      <Textarea
        value={task.actualBehavior}
        onChange={setActualBehavior}
        placeholder="What actually happens?"
      />
    </Field>
  </>
)}

{['Story', 'Task', 'Epic'].includes(taskType) && (
  <Field label="Acceptance Criteria">
    <ChecklistEditor
      items={task.acceptanceCriteria}
      onChange={setAcceptanceCriteria}
      placeholder="Add acceptance criteria..."
    />
  </Field>
)}
```

**Acceptance Criteria Component:**
```jsx
// ChecklistEditor.jsx
const ChecklistEditor = ({ items, onChange }) => {
  return (
    <div>
      {items.map((item, idx) => (
        <ChecklistItem key={idx}>
          <DragHandle />
          <Input
            value={item.text}
            onChange={e => updateItem(idx, e.target.value)}
            placeholder="Acceptance criterion..."
          />
          <IconButton
            icon={<TrashIcon />}
            onClick={() => removeItem(idx)}
          />
        </ChecklistItem>
      ))}
      
      <Button onClick={addItem}>+ Add Criterion</Button>
    </div>
  );
};
```

**Schema Updates:**
```javascript
// Task model additions
{
  // For bugs
  environment: {
    type: String,
    enum: ['dev', 'staging', 'production', 'local']
  },
  stepsToReproduce: String,
  expectedBehavior: String,
  actualBehavior: String,
  
  // For stories/tasks
  acceptanceCriteria: [{
    text: String,
    completed: Boolean,
    order: Number
  }]
}
```

**Testing:**
- [ ] Bug form shows environment + steps fields
- [ ] Story form shows acceptance criteria
- [ ] Acceptance criteria reorderable by drag
- [ ] Acceptance criteria checkable during review
- [ ] Fields required validation for bugs
- [ ] Markdown preview for steps to reproduce
- [ ] Fields shown in task detail view

---

### Wave 2 Success Metrics

| Metric | Target | Validation |
|--------|--------|------------|
| @Mention adoption | 80% of team uses within 1 week | Usage analytics |
| Notification delivery | <100ms real-time latency | Performance test |
| Board filter usage | 60% of board views use filters | Analytics |
| Swimlane adoption | 50% of boards use swimlanes | Board settings audit |
| WIP limit compliance | 90% of time limits not exceeded | WIP violation logs |
| Bug report quality | 100% bugs have environment + steps | Data quality audit |

---

## Wave 3: Advanced Project Management (Weeks 5-6)

### Objective
Implement sophisticated project management features that distinguish Nexora from basic issue trackers. Enable multi-project organizations to scale effectively.

### Features to Implement

#### 3.1 Per-Project Role Assignment

**3.1.1 Architecture Change**

**Database Schema:**
```javascript
// New ProjectMember model (replaces flat org roles)
{
  projectId: ObjectId,
  userId: ObjectId,
  role: {
    type: String,
    enum: ['admin', 'lead', 'developer', 'viewer'],
    required: true
  },
  permissions: [String], // Override specific permissions
  addedAt: Date,
  addedBy: ObjectId
}

// User retains orgRole for organization-level permissions
{
  orgRole: {
    type: String,
    enum: ['platform_admin', 'admin', 'manager', 'member', 'viewer']
  }
}
```

**Permission Resolution Logic:**
```javascript
// utils/permissions.js
const getUserProjectRole = async (userId, projectId) => {
  const projectMember = await ProjectMember.findOne({
    userId,
    projectId
  });
  
  if (!projectMember) return null; // Not a project member
  
  return projectMember.role;
};

const canAccessProject = async (user, projectId, permission) => {
  // Platform admin can do anything
  if (user.orgRole === 'platform_admin') return true;
  
  // Check project-specific role
  const projectRole = await getUserProjectRole(user._id, projectId);
  
  if (!projectRole) return false;
  
  const projectPermissions = PROJECT_ROLE_PERMISSIONS[projectRole];
  return projectPermissions.includes(permission);
};
```

**UI: Project Member Management**
```jsx
// ProjectMembersPage.jsx
<MembersTable>
  <thead>
    <tr>
      <th>Name</th>
      <th>Org Role</th>
      <th>Project Role</th>
      <th>Added</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {projectMembers.map(member => (
      <tr key={member.id}>
        <td>
          <UserCell user={member.user} />
        </td>
        <td>
          <Badge>{member.user.orgRole}</Badge>
        </td>
        <td>
          <Select
            value={member.projectRole}
            onChange={v => updateProjectRole(member.id, v)}
            disabled={!canManageMembers}
          >
            <option value="admin">Project Admin</option>
            <option value="lead">Tech Lead</option>
            <option value="developer">Developer</option>
            <option value="viewer">Viewer</option>
          </Select>
        </td>
        <td>{formatDate(member.addedAt)}</td>
        <td>
          <IconButton
            icon={<TrashIcon />}
            onClick={() => removeFromProject(member.id)}
          />
        </td>
      </tr>
    ))}
  </tbody>
</MembersTable>

<Button onClick={openAddMemberModal}>
  + Add Member to Project
</Button>
```

**Testing:**
- [ ] User can be "admin" on Project A, "developer" on Project B
- [ ] Project role overrides org role for project access
- [ ] Platform admin retains access to all projects
- [ ] Removing project role revokes project access
- [ ] Task assignment validates project membership
- [ ] Sprint assignment validates project role
- [ ] Migration script for existing projects

---

#### 3.2 Issue Cloning & Templates

**3.2.1 Clone Issue**

**UI:**
```jsx
// TaskDetailPage.jsx - Actions menu
<MenuButton>
  <MenuItem onClick={handleClone}>
    <CloneIcon /> Clone Issue
  </MenuItem>
</MenuButton>
```

**Clone Modal:**
```jsx
<Modal title="Clone Issue">
  <p>Create a copy of {task.key}</p>
  
  <Field label="New Summary">
    <Input
      value={cloneSummary}
      onChange={setCloneSummary}
      defaultValue={`${task.title} (Copy)`}
    />
  </Field>
  
  <CheckboxGroup label="Include">
    <Checkbox
      checked={cloneOptions.description}
      onChange={v => setCloneOption('description', v)}
      label="Description"
      defaultChecked
    />
    <Checkbox
      checked={cloneOptions.attachments}
      label="Attachments"
    />
    <Checkbox
      checked={cloneOptions.subtasks}
      label="Sub-tasks"
    />
    <Checkbox
      checked={cloneOptions.comments}
      label="Comments"
    />
    <Checkbox
      checked={cloneOptions.links}
      label="Links"
    />
  </CheckboxGroup>
  
  <Field label="Destination Project">
    <Select value={targetProject} onChange={setTargetProject}>
      {userProjects.map(p => (
        <option value={p.id}>{p.name}</option>
      ))}
    </Select>
  </Field>
  
  <Actions>
    <Button onClick={onClose}>Cancel</Button>
    <Button primary onClick={handleCloneSubmit}>Clone</Button>
  </Actions>
</Modal>
```

**Backend:**
```javascript
// POST /api/tasks/:taskId/clone
{
  title: "Task Copy",
  targetProjectId: "...",
  include: {
    description: true,
    attachments: false,
    subtasks: true,
    comments: false,
    links: true
  }
}

Response: {
  clonedTask: { ... },
  clonedSubtasks: [...],
  message: "Successfully cloned DQM-142 to DQM-203"
}
```

**Testing:**
- [ ] Clone task within same project
- [ ] Clone task to different project (key changes)
- [ ] Clone with/without description
- [ ] Clone with/without sub-tasks
- [ ] Clone preserves custom fields
- [ ] Clone links back to original (clonedFrom field)
- [ ] Activity log shows clone action

---

**3.2.2 Task Templates**

**Template Management UI:**
```jsx
// ProjectSettings → Templates tab
<TemplatesList>
  {templates.map(template => (
    <TemplateCard key={template.id}>
      <h3>{template.name}</h3>
      <p>{template.description}</p>
      <Badge>{template.type}</Badge>
      <Actions>
        <Button onClick={() => editTemplate(template)}>Edit</Button>
        <Button onClick={() => deleteTemplate(template.id)}>Delete</Button>
      </Actions>
    </TemplateCard>
  ))}
</TemplatesList>

<Button onClick={createTemplate}>+ New Template</Button>
```

**Template Editor:**
```jsx
<Modal title="Create Task Template">
  <Field label="Template Name">
    <Input value={template.name} placeholder="Bug Report Template" />
  </Field>
  
  <Field label="Task Type">
    <Select value={template.type}>
      <option value="bug">Bug</option>
      <option value="story">Story</option>
      <option value="task">Task</option>
    </Select>
  </Field>
  
  <Field label="Default Title">
    <Input value={template.defaultTitle} placeholder="[Component] Bug Title" />
  </Field>
  
  <Field label="Description Template">
    <MarkdownEditor
      value={template.descriptionTemplate}
      placeholder="## Steps to Reproduce&#10;1. &#10;&#10;## Expected&#10;&#10;## Actual"
    />
  </Field>
  
  <Field label="Default Fields">
    <CheckboxGroup>
      <Checkbox label="Priority: High" checked={template.defaults.priority === 'High'} />
      <Checkbox label="Auto-assign to reporter" checked={template.autoAssignReporter} />
    </CheckboxGroup>
  </Field>
  
  <Field label="Acceptance Criteria">
    <ChecklistEditor items={template.acceptanceCriteria} />
  </Field>
  
  <Button primary onClick={saveTemplate}>Save Template</Button>
</Modal>
```

**Using Templates:**
```jsx
// Create Task button dropdown
<SplitButton onClick={openCreateTask}>
  <ButtonMenu>
    <MenuItem onClick={() => openCreateTask()}>Blank Task</MenuItem>
    <MenuDivider />
    <MenuLabel>Templates</MenuLabel>
    {templates.map(t => (
      <MenuItem key={t.id} onClick={() => openCreateTask(t.id)}>
        {t.name}
      </MenuItem>
    ))}
  </ButtonMenu>
</SplitButton>
```

**Testing:**
- [ ] Create template from existing task
- [ ] Create template from scratch
- [ ] Use template to create task
- [ ] Template pre-fills all fields correctly
- [ ] Template fields are editable before save
- [ ] Templates filterable by type
- [ ] Template permissions (who can create/edit)

---

#### 3.3 Project Visibility Controls

**3.3.1 Project Privacy Settings**

**UI in Project Settings:**
```jsx
<Section title="Project Visibility">
  <RadioGroup value={project.visibility} onChange={setVisibility}>
    <Radio value="public">
      <RadioLabel>
        <GlobeIcon /> Public
        <Help>All organization members can view this project</Help>
      </RadioLabel>
    </Radio>
    
    <Radio value="private">
      <RadioLabel>
        <LockIcon /> Private
        <Help>Only invited members can access this project</Help>
      </RadioLabel>
    </Radio>
    
    <Radio value="restricted">
      <RadioLabel>
        <ShieldIcon /> Restricted
        <Help>Only admins and explicitly granted members</Help>
      </RadioLabel>
    </Radio>
  </RadioGroup>
  
  {project.visibility === 'private' && (
    <InviteMembersSection>
      <h4>Project Members ({projectMembers.length})</h4>
      <MembersList />
      <Button onClick={inviteMember}>+ Invite Member</Button>
    </InviteMembersSection>
  )}
</Section>
```

**Access Control Logic:**
```javascript
// middleware/projectAccess.js
const checkProjectAccess = async (req, res, next) => {
  const { projectId } = req.params;
  const userId = req.user._id;
  
  const project = await Project.findById(projectId);
  
  // Public projects: all org members
  if (project.visibility === 'public') {
    return next();
  }
  
  // Private/Restricted: check membership
  const membership = await ProjectMember.findOne({
    projectId,
    userId
  });
  
  if (!membership) {
    return res.status(403).json({
      error: 'You do not have access to this project'
    });
  }
  
  next();
};
```

**Frontend Project List Filtering:**
```javascript
// Only show projects user has access to
const getAccessibleProjects = async (userId) => {
  // Get user's org role
  const user = await User.findById(userId);
  
  if (user.orgRole === 'platform_admin') {
    return Project.find(); // Admin sees all
  }
  
  // Get projects where user is member OR project is public
  const projectIds = await ProjectMember.distinct('projectId', {
    userId
  });
  
  return Project.find({
    $or: [
      { _id: { $in: projectIds } },
      { visibility: 'public' }
    ]
  });
};
```

**Testing:**
- [ ] Create public project → all org members see it
- [ ] Create private project → only members see it
- [ ] Switch project visibility updates access
- [ ] Non-member cannot access private project (403)
- [ ] Non-member cannot see private project in list
- [ ] Admin can access all projects regardless
- [ ] URL guessing blocked for private projects

---

#### 3.4 Fix Version, Components, Release Fields

**3.4.1 Project Components**

**Component Management:**
```jsx
// ProjectSettings → Components
<ComponentsSection>
  <ComponentsTable>
    <thead>
      <tr>
        <th>Component</th>
        <th>Description</th>
        <th>Lead</th>
        <th>Default Assignee</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {components.map(comp => (
        <tr key={comp.id}>
          <td>{comp.name}</td>
          <td>{comp.description}</td>
          <td><UserAvatar user={comp.lead} /></td>
          <td><UserAvatar user={comp.defaultAssignee} /></td>
          <td>
            <IconButton icon={<EditIcon />} onClick={() => editComponent(comp)} />
            <IconButton icon={<TrashIcon />} onClick={() => deleteComponent(comp.id)} />
          </td>
        </tr>
      ))}
    </tbody>
  </ComponentsTable>
  
  <Button onClick={createComponent}>+ Add Component</Button>
</ComponentsSection>
```

**Component in Task Form:**
```jsx
<Field label="Components">
  <MultiSelect
    value={task.components}
    onChange={setComponents}
    options={projectComponents}
    placeholder="Select components..."
  />
</Field>
```

**Schema:**
```javascript
// Component model
{
  projectId: ObjectId,
  name: String,              // e.g., "Authentication"
  description: String,
  lead: ObjectId,            // Component owner
  defaultAssignee: ObjectId, // Auto-assign when component selected
  color: String
}

// Task schema addition
{
  components: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Component'
  }]
}
```

---

**3.4.2 Fix Versions & Releases**

**Version Management:**
```jsx
// ProjectSettings → Releases
<ReleasesTimeline>
  {releases.map(release => (
    <ReleaseCard key={release.id} status={release.status}>
      <ReleaseHeader>
        <h3>{release.name}</h3>
        <Badge status={release.status}>{release.status}</Badge>
      </ReleaseHeader>
      
      <ReleaseDetails>
        <Detail label="Release Date" value={release.releaseDate} />
        <Detail label="Issues" value={`${release.issueCount} (${release.completedCount} done)`} />
        <Detail label="Progress">
          <ProgressBar
            value={release.completedCount}
            max={release.issueCount}
          />
        </Detail>
      </ReleaseDetails>
      
      <Actions>
        <Button onClick={() => editRelease(release)}>Edit</Button>
        {release.status === 'planned' && (
          <Button onClick={() => startRelease(release.id)}>Start Release</Button>
        )}
        {release.status === 'in_progress' && (
          <Button onClick={() => completeRelease(release.id)}>Release</Button>
        )}
      </Actions>
    </ReleaseCard>
  ))}
</ReleasesTimeline>

<Button onClick={createRelease}>+ New Release</Button>
```

**Task Form:**
```jsx
<Field label="Fix Version">
  <Select
    value={task.fixVersion}
    onChange={setFixVersion}
    options={projectReleases.filter(r => r.status !== 'released')}
  />
</Field>
```

**Release Model:**
```javascript
{
  projectId: ObjectId,
  name: String,                    // "v2.1.0", "Sprint 24 Release"
  description: String,
  releaseDate: Date,
  status: {
    type: String,
    enum: ['planned', 'in_progress', 'released', 'archived']
  },
  startDate: Date,
  releasedDate: Date,
  releaseNotes: String,           // Markdown
  issues: [ObjectId]              // Cached for performance
}
```

**Testing:**
- [ ] Create component with lead
- [ ] Assign task to component → auto-assigns to component lead
- [ ] Filter tasks by component
- [ ] Create release (version)
- [ ] Assign task to fix version
- [ ] Release progress auto-updates as tasks complete
- [ ] Complete release → tasks marked as released
- [ ] Generate release notes from completed tasks

---

#### 3.5 Bulk CSV Member Invite

**3.5.1 CSV Upload UI**

```jsx
// Settings → Members → Bulk Invite
<BulkInviteSection>
  <h3>Bulk Invite via CSV</h3>
  
  <FileUpload
    accept=".csv"
    onChange={handleCsvUpload}
    label="Upload CSV"
  />
  
  <Template>
    <h4>CSV Template</h4>
    <CodeBlock>
      email,role,firstName,lastName,department,jobTitle
      rohan@pixelcraft.io,member,Rohan,Deshmukh,Engineering,Senior Unity Developer
      naina@pixelcraft.io,member,Naina,Sharma,QA,QA Lead
    </CodeBlock>
    <Button onClick={downloadTemplate}>Download Template</Button>
  </Template>
  
  {csvData && (
    <PreviewSection>
      <h4>Preview ({csvData.length} users)</h4>
      <PreviewTable>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Name</th>
            <th>Department</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {csvData.map((row, idx) => (
            <tr key={idx} className={row.error ? 'error' : ''}>
              <td>{row.email}</td>
              <td>{row.role}</td>
              <td>{row.firstName} {row.lastName}</td>
              <td>{row.department}</td>
              <td>
                {row.error ? (
                  <Error>{row.error}</Error>
                ) : (
                  <Success>Valid</Success>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </PreviewTable>
      
      <Actions>
        <Button onClick={cancelUpload}>Cancel</Button>
        <Button
          primary
          onClick={sendInvites}
          disabled={hasErrors}
        >
          Send {validCount} Invites
        </Button>
      </Actions>
    </PreviewSection>
  )}
</BulkInviteSection>
```

**CSV Parser & Validator:**
```javascript
// utils/csvInviteParser.js
import Papa from 'papaparse';

const validateInviteRow = (row) => {
  const errors = [];
  
  // Validate email
  if (!row.email || !isValidEmail(row.email)) {
    errors.push('Invalid email');
  }
  
  // Validate role
  if (!['admin', 'manager', 'member', 'viewer'].includes(row.role)) {
    errors.push('Invalid role');
  }
  
  // Validate required fields
  if (!row.firstName || !row.lastName) {
    errors.push('First and last name required');
  }
  
  return errors;
};

export const parseCsvInvites = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const validated = results.data.map(row => {
          const errors = validateInviteRow(row);
          return {
            ...row,
            valid: errors.length === 0,
            errors
          };
        });
        resolve(validated);
      },
      error: reject
    });
  });
};
```

**Backend Bulk Invite:**
```javascript
// POST /api/organization/members/bulk-invite
{
  invites: [
    {
      email: "rohan@pixelcraft.io",
      role: "member",
      firstName: "Rohan",
      lastName: "Deshmukh",
      department: "Engineering",
      jobTitle: "Senior Unity Developer"
    },
    // ... more
  ]
}

Response: {
  success: 15,
  failed: 2,
  details: [
    { email: "duplicate@example.com", error: "User already exists" },
    { email: "invalid@", error: "Invalid email format" }
  ]
}
```

**Testing:**
- [ ] Upload valid CSV → all invites sent
- [ ] Upload CSV with errors → shows validation errors
- [ ] Duplicate emails detected
- [ ] Download CSV template
- [ ] Bulk invite sends emails (async)
- [ ] Invite status tracked per row
- [ ] Partial success handled (15/17 invited)

---

### Wave 3 Success Metrics

| Metric | Target | Validation |
|--------|--------|------------|
| Per-project roles implemented | 100% of projects support it | Code audit |
| Issue cloning usage | 20% of team clones issue in first week | Analytics |
| Task templates created | 5+ templates per project | Template count |
| Project visibility compliance | 0 unauthorized access attempts | Security logs |
| Components adoption | 60% of projects use components | Component data |
| Fix version usage | 80% of production bugs have fix version | Data audit |
| Bulk invite success rate | 95% of CSV rows processed | Invite logs |

---

## Wave 4: Reporting & Market Differentiators (Weeks 7-8)

### Objective
Complete the reporting layer and implement 3 unique features that differentiate Nexora from Jira, addressing PixelCraft's specific pain points.

### Features to Implement

#### 4.1 Complete Reporting Layer

**4.1.1 Cumulative Flow Diagram**

```jsx
// CumulativeFlowDiagram.jsx
import { Line } from 'react-chartjs-2';

const CumulativeFlowDiagram = ({ projectId, dateRange }) => {
  const { data } = useFetch(
    `/api/projects/${projectId}/reports/cumulative-flow?from=${dateRange.from}&to=${dateRange.to}`
  );
  
  const chartData = {
    labels: data.dates, // ['Mar 1', 'Mar 2', ...]
    datasets: data.columns.map((col, idx) => ({
      label: col.name,
      data: col.counts,
      backgroundColor: col.color,
      borderColor: col.color,
      fill: true,
      stack: 'stack1'
    }))
  };
  
  return (
    <ChartContainer>
      <ChartHeader>
        <h3>Cumulative Flow Diagram</h3>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </ChartHeader>
      <Line data={chartData} options={stackedAreaOptions} />
      <Insights>
        <Insight icon={<TrendIcon />}>
          WIP increased by 15% in the last week
        </Insight>
        <Insight icon={<WarningIcon />}>
          "In Progress" column is bottleneck (35 tasks)
        </Insight>
      </Insights>
    </ChartContainer>
  );
};
```

**Backend:**
```javascript
// GET /api/projects/:projectId/reports/cumulative-flow
// Returns daily snapshots of task counts per column
Response: {
  dates: ['2026-03-01', '2026-03-02', ...],
  columns: [
    {
      name: 'To Do',
      color: '#e5e7eb',
      counts: [45, 43, 41, 38, ...]
    },
    {
      name: 'In Progress',
      color: '#3b82f6',
      counts: [12, 15, 18, 22, ...]
    },
    // ... more columns
  ]
}
```

---

**4.1.2 Control Chart (Cycle Time)**

```jsx
const ControlChart = ({ projectId }) => {
  const { data } = useFetch(`/api/projects/${projectId}/reports/cycle-time`);
  
  const chartData = {
    datasets: [
      {
        label: 'Cycle Time',
        data: data.tasks.map(t => ({
          x: t.completedDate,
          y: t.cycleTimeDays
        })),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
      },
      {
        label: 'Average',
        data: data.tasks.map(t => ({
          x: t.completedDate,
          y: data.avgCycleTime
        })),
        type: 'line',
        borderColor: 'rgb(34, 197, 94)',
        borderDash: [5, 5],
      }
    ]
  };
  
  return (
    <ChartContainer>
      <h3>Control Chart — Cycle Time</h3>
      <Scatter data={chartData} options={...} />
      <Stats>
        <Stat label="Avg Cycle Time" value={`${data.avgCycleTime} days`} />
        <Stat label="Median" value={`${data.medianCycleTime} days`} />
        <Stat label="90th Percentile" value={`${data.p90CycleTime} days`} />
      </Stats>
    </ChartContainer>
  );
};
```

---

**4.1.3 Epic Progress Report**

```jsx
const EpicProgressReport = ({ projectId }) => {
  const { epics } = useFetch(`/api/projects/${projectId}/reports/epic-progress`);
  
  return (
    <ReportContainer>
      <h2>Epic Progress Report</h2>
      
      {epics.map(epic => (
        <EpicCard key={epic.id}>
          <EpicHeader>
            <h3>{epic.key}: {epic.title}</h3>
            <StatusBadge status={epic.status}>{epic.status}</StatusBadge>
          </EpicHeader>
          
          <ProgressSection>
            <ProgressBar
              value={epic.completedStories}
              max={epic.totalStories}
              label={`${epic.completedStories} / ${epic.totalStories} stories`}
            />
            <ProgressBar
              value={epic.completedPoints}
              max={epic.totalPoints}
              label={`${epic.completedPoints} / ${epic.totalPoints} points`}
            />
          </ProgressSection>
          
          <Timeline>
            <TimelineItem label="Start Date" date={epic.startDate} />
            <TimelineItem label="Target Date" date={epic.targetDate} />
            <TimelineItem
              label="Projected Completion"
              date={epic.projectedCompletion}
              isProjection
            />
          </Timeline>
          
          <StoriesBreakdown>
            <h4>Stories ({epic.totalStories})</h4>
            <StoriesList>
              {epic.stories.map(story => (
                <StoryRow key={story.id}>
                  <span>{story.key}</span>
                  <span>{story.title}</span>
                  <StatusBadge>{story.status}</StatusBadge>
                  <Points>{story.points} pts</Points>
                </StoryRow>
              ))}
            </StoriesList>
          </StoriesBreakdown>
        </EpicCard>
      ))}
    </ReportContainer>
  );
};
```

---

**4.1.4 CSV/PDF Export**

```jsx
// ExportButton.jsx
const ExportButton = ({ reportType, projectId, filters }) => {
  const handleExport = async (format) => {
    const url = `/api/projects/${projectId}/reports/${reportType}/export?format=${format}&${qs.stringify(filters)}`;
    
    const response = await fetch(url);
    const blob = await response.blob();
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${reportType}-${Date.now()}.${format}`;
    link.click();
  };
  
  return (
    <DropdownButton label="Export">
      <MenuItem onClick={() => handleExport('csv')}>
        <CsvIcon /> Export as CSV
      </MenuItem>
      <MenuItem onClick={() => handleExport('pdf')}>
        <PdfIcon /> Export as PDF
      </MenuItem>
      <MenuItem onClick={() => handleExport('xlsx')}>
        <ExcelIcon /> Export as Excel
      </MenuItem>
    </DropdownButton>
  );
};
```

**Backend Export (CSV):**
```javascript
// GET /api/projects/:projectId/reports/velocity/export?format=csv
const exportVelocityReport = async (req, res) => {
  const { projectId } = req.params;
  const { format } = req.query;
  
  const sprints = await Sprint.find({ projectId })
    .sort({ startDate: -1 })
    .limit(10);
  
  if (format === 'csv') {
    const csv = Papa.unparse(sprints.map(s => ({
      Sprint: s.name,
      'Start Date': s.startDate,
      'End Date': s.endDate,
      'Committed Points': s.committedPoints,
      'Completed Points': s.completedPoints,
      'Completion %': (s.completedPoints / s.committedPoints * 100).toFixed(1)
    })));
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=velocity-${Date.now()}.csv`);
    res.send(csv);
  }
  
  // Similar for PDF using puppeteer or pdfkit
};
```

**Testing:**
- [ ] CFD renders with stacked area chart
- [ ] Control chart shows cycle time scatter
- [ ] Epic progress shows completion %
- [ ] CSV export downloads file
- [ ] PDF export renders correctly
- [ ] Excel export preserves formulas
- [ ] Export respects date range filters
- [ ] Large dataset export handles pagination

---

#### 4.2 Market Differentiator #1: Visual Asset Preview

**Problem:** Game designers at PixelCraft attach Figma mockups, character art PNGs, and Unity screenshots to tasks. In Jira, these show as plain attachment links — no thumbnails, no preview. Designers waste time downloading files just to see what they are.

**Solution:** Rich visual asset preview with image gallery, video player, and Figma embed.

**Implementation:**

```jsx
// TaskAttachments.jsx
const TaskAttachments = ({ task }) => {
  const { attachments } = task;
  
  return (
    <AttachmentsSection>
      <SectionHeader>
        <h3>Attachments ({attachments.length})</h3>
        <Button onClick={openUploadModal}>+ Upload</Button>
      </SectionHeader>
      
      <AttachmentGrid>
        {attachments.map(file => (
          <AttachmentCard key={file.id} type={file.type}>
            {file.type === 'image' && (
              <ImagePreview
                src={file.thumbnailUrl || file.url}
                onClick={() => openLightbox(file)}
              />
            )}
            
            {file.type === 'video' && (
              <VideoThumbnail
                src={file.thumbnailUrl}
                duration={file.duration}
                onClick={() => openVideoPlayer(file)}
              />
            )}
            
            {file.type === 'figma' && (
              <FigmaEmbed
                url={file.url}
                onClick={() => openFigmaViewer(file)}
              />
            )}
            
            {file.type === 'document' && (
              <DocumentThumbnail
                icon={getFileIcon(file.extension)}
                name={file.name}
              />
            )}
            
            <FileInfo>
              <FileName>{file.name}</FileName>
              <FileSize>{formatBytes(file.size)}</FileSize>
              <Uploader>by {file.uploadedBy.name}</Uploader>
            </FileInfo>
            
            <Actions>
              <IconButton icon={<DownloadIcon />} onClick={() => download(file)} />
              <IconButton icon={<TrashIcon />} onClick={() => deleteFile(file)} />
            </Actions>
          </AttachmentCard>
        ))}
      </AttachmentGrid>
      
      {/* Image Lightbox */}
      <Lightbox
        isOpen={lightboxOpen}
        images={imageAttachments}
        currentIndex={currentImageIndex}
        onClose={() => setLightboxOpen(false)}
        onNext={nextImage}
        onPrev={prevImage}
      />
    </AttachmentsSection>
  );
};
```

**Image Processing Pipeline:**
```javascript
// services/file-service/src/processors/imageProcessor.js
import sharp from 'sharp';

export const processImageUpload = async (file) => {
  const originalPath = file.path;
  const thumbnailPath = `${file.path}-thumb.jpg`;
  
  // Generate thumbnail (400x400)
  await sharp(originalPath)
    .resize(400, 400, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath);
  
  // Get image metadata
  const metadata = await sharp(originalPath).metadata();
  
  return {
    ...file,
    thumbnailUrl: uploadToS3(thumbnailPath),
    width: metadata.width,
    height: metadata.height,
    format: metadata.format
  };
};
```

**Figma Embed:**
```jsx
const FigmaEmbed = ({ url }) => {
  // Extract file key from Figma URL
  const fileKey = extractFigmaFileKey(url);
  const embedUrl = `https://www.figma.com/embed?embed_host=nexora&url=${encodeURIComponent(url)}`;
  
  return (
    <FigmaFrame>
      <iframe
        src={embedUrl}
        allowFullScreen
        title="Figma Design"
      />
      <ExternalLink href={url} target="_blank">
        Open in Figma <ExternalLinkIcon />
      </ExternalLink>
    </FigmaFrame>
  );
};
```

**Testing:**
- [ ] Upload image → thumbnail generated
- [ ] Click image → lightbox opens
- [ ] Lightbox navigation (prev/next) works
- [ ] Upload video → thumbnail extracted
- [ ] Figma URL detected and embedded
- [ ] Large images compressed for web
- [ ] Attachment grid responsive on mobile
- [ ] Download original file works

---

#### 4.3 Market Differentiator #2: Client Feedback Portal

**Problem:** PixelCraft's client (DreamGames Corp) emails feedback, sends WhatsApp messages with screenshots, and sometimes calls. Feedback is scattered. The client wants to see progress but giving them Jira access is overkill and confusing.

**Solution:** Dedicated client portal with feedback submission, milestone tracking, and simplified progress view — no Jira complexity.

**4.3.1 Client Portal UI**

```jsx
// ClientPortal.jsx (separate subdomain: client.nexora.app)
const ClientPortal = () => {
  const { project, milestones } = useClientProject();
  
  return (
    <ClientLayout>
      <Header>
        <Logo />
        <ProjectTitle>{project.name}</ProjectTitle>
        <UserMenu user={clientUser} />
      </Header>
      
      <Dashboard>
        <OverviewSection>
          <MilestoneProgress
            current={project.currentMilestone}
            total={milestones.length}
            completionPercentage={project.completionPercentage}
          />
          
          <NextMilestone>
            <h3>Next Milestone: {nextMilestone.name}</h3>
            <DueDate>Due: {nextMilestone.dueDate}</DueDate>
            <ProgressBar value={nextMilestone.progress} />
          </NextMilestone>
        </OverviewSection>
        
        <MilestoneTimeline milestones={milestones} />
        
        <RecentUpdatesSection>
          <h2>Recent Updates</h2>
          {project.updates.map(update => (
            <UpdateCard key={update.id}>
              <UpdateDate>{update.date}</UpdateDate>
              <UpdateTitle>{update.title}</UpdateTitle>
              <UpdateBody>{update.body}</UpdateBody>
              {update.attachments && (
                <Attachments files={update.attachments} />
              )}
            </UpdateCard>
          ))}
        </RecentUpdatesSection>
        
        <FeedbackSection>
          <h2>Submit Feedback</h2>
          <FeedbackForm onSubmit={submitFeedback} />
        </FeedbackSection>
      </Dashboard>
    </ClientLayout>
  );
};
```

**Feedback Submission Form:**
```jsx
const FeedbackForm = ({ onSubmit }) => {
  const [feedback, setFeedback] = useState({
    type: 'bug',
    title: '',
    description: '',
    priority: 'medium',
    attachments: []
  });
  
  return (
    <Form onSubmit={handleSubmit}>
      <Field label="Type">
        <Select value={feedback.type} onChange={v => setField('type', v)}>
          <option value="bug">Bug Report</option>
          <option value="feature">Feature Request</option>
          <option value="question">Question</option>
          <option value="general">General Feedback</option>
        </Select>
      </Field>
      
      <Field label="Title" required>
        <Input
          value={feedback.title}
          onChange={v => setField('title', v)}
          placeholder="Brief summary..."
        />
      </Field>
      
      <Field label="Description" required>
        <Textarea
          value={feedback.description}
          onChange={v => setField('description', v)}
          placeholder="Please describe in detail..."
          rows={6}
        />
      </Field>
      
      <Field label="Priority">
        <RadioGroup value={feedback.priority} onChange={v => setField('priority', v)}>
          <Radio value="low">Low — Nice to have</Radio>
          <Radio value="medium">Medium — Important</Radio>
          <Radio value="high">High — Blocking our work</Radio>
        </RadioGroup>
      </Field>
      
      <Field label="Attachments">
        <FileUpload
          multiple
          accept="image/*,video/*,.pdf"
          onChange={files => setField('attachments', files)}
        />
      </Field>
      
      <Button type="submit" primary>Submit Feedback</Button>
    </Form>
  );
};
```

**Backend: Feedback → Task Conversion**
```javascript
// POST /api/client-portal/projects/:projectId/feedback
const submitClientFeedback = async (req, res) => {
  const { projectId } = req.params;
  const { type, title, description, priority, attachments } = req.body;
  const clientUser = req.user;
  
  // Create task in project with [CLIENT] tag
  const task = await Task.create({
    projectId,
    title: `[CLIENT] ${title}`,
    description,
    type: type === 'bug' ? 'bug' : type === 'feature' ? 'story' : 'task',
    priority: priorityMapping[priority],
    reporter: clientUser._id,
    labels: ['client-feedback'],
    status: 'To Do',
    attachments: await uploadAttachments(attachments)
  });
  
  // Notify project team
  await notifyTeam(projectId, {
    message: `New client feedback: ${task.key}`,
    task
  });
  
  // Send confirmation to client
  await sendEmail(clientUser.email, {
    subject: 'Feedback Received',
    body: `Thank you for your feedback. We've logged it as ${task.key} and will review it shortly.`
  });
  
  res.json({ success: true, taskKey: task.key });
};
```

**Testing:**
- [ ] Client can access portal without Nexora login
- [ ] Client sees only their project
- [ ] Milestone progress updates real-time
- [ ] Client submits feedback → creates task
- [ ] Task tagged with [CLIENT] label
- [ ] Team notified of new client feedback
- [ ] Client receives confirmation email
- [ ] Client can view status of their feedback

---

#### 4.4 Market Differentiator #3: Built-in Time Tracking

**Problem:** PixelCraft pays $5/user/month for Tempo Timesheets (₹7,500/month = ₹90K/year). They need time tracking for client billing and internal project costing.

**Solution:** Native time tracking with task-level logging, weekly timesheets, approval workflow, and billing reports.

**4.4.1 Task-Level Time Logging**

```jsx
// TaskDetailPage.jsx - Time Tracking Section
const TimeTrackingSection = ({ task }) => {
  const [isLogging, setIsLogging] = useState(false);
  const { timeLogs, totalTime } = useTimeLogs(task.id);
  
  return (
    <Section>
      <SectionHeader>
        <h3>Time Tracking</h3>
        <TimeDisplay>
          <ClockIcon />
          {formatDuration(totalTime)} logged
        </TimeDisplay>
      </SectionHeader>
      
      <QuickActions>
        <Button onClick={startTimer} disabled={isLogging}>
          <PlayIcon /> Start Timer
        </Button>
        <Button onClick={openLogTimeModal}>
          <PlusIcon /> Log Time Manually
        </Button>
      </QuickActions>
      
      {isLogging && (
        <ActiveTimer>
          <TimerDisplay>
            <RunningClock startTime={timerStart} />
          </TimerDisplay>
          <Button onClick={stopTimer} danger>
            <StopIcon /> Stop & Log
          </Button>
        </ActiveTimer>
      )}
      
      <TimeLogsList>
        {timeLogs.map(log => (
          <TimeLogRow key={log.id}>
            <User>
              <Avatar src={log.user.avatar} />
              <span>{log.user.name}</span>
            </User>
            <Duration>{formatDuration(log.duration)}</Duration>
            <Date>{formatDate(log.date)}</Date>
            <Description>{log.description}</Description>
            <Actions>
              <IconButton icon={<EditIcon />} onClick={() => editLog(log)} />
              <IconButton icon={<TrashIcon />} onClick={() => deleteLog(log.id)} />
            </Actions>
          </TimeLogRow>
        ))}
      </TimeLogsList>
    </Section>
  );
};
```

**Log Time Modal:**
```jsx
const LogTimeModal = ({ task, onSubmit }) => {
  const [timeLog, setTimeLog] = useState({
    date: new Date(),
    duration: '',
    description: ''
  });
  
  return (
    <Modal title="Log Time">
      <Field label="Date">
        <DatePicker
          value={timeLog.date}
          onChange={d => setField('date', d)}
        />
      </Field>
      
      <Field label="Time Spent">
        <DurationInput
          value={timeLog.duration}
          onChange={d => setField('duration', d)}
          placeholder="e.g., 2h 30m"
        />
        <HelpText>
          Formats: 2h, 2.5h, 2h 30m, 150m
        </HelpText>
      </Field>
      
      <Field label="Description">
        <Textarea
          value={timeLog.description}
          onChange={d => setField('description', d)}
          placeholder="What did you work on?"
        />
      </Field>
      
      <Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button primary onClick={() => onSubmit(timeLog)}>
          Log Time
        </Button>
      </Actions>
    </Modal>
  );
};
```

**Timer Implementation:**
```javascript
// hooks/useTimer.js
export const useTimer = (taskId) => {
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    if (!isRunning) return;
    
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isRunning, startTime]);
  
  const start = () => {
    setStartTime(Date.now());
    setIsRunning(true);
    
    // Persist timer to localStorage (survive page refresh)
    localStorage.setItem('activeTimer', JSON.stringify({
      taskId,
      startTime: Date.now()
    }));
  };
  
  const stop = async (description) => {
    const duration = elapsed;
    setIsRunning(false);
    setElapsed(0);
    
    // Log time to backend
    await logTime(taskId, {
      duration,
      date: new Date(),
      description
    });
    
    localStorage.removeItem('activeTimer');
  };
  
  return { isRunning, elapsed, start, stop };
};
```

---

**4.4.2 Weekly Timesheet View**

```jsx
const WeeklyTimesheet = ({ userId, weekStart }) => {
  const { timesheet, totalHours } = useTimesheet(userId, weekStart);
  const weekDays = getWeekDays(weekStart);
  
  return (
    <TimesheetContainer>
      <Header>
        <WeekSelector value={weekStart} onChange={setWeekStart} />
        <TotalHours>{totalHours}h this week</TotalHours>
        <SubmitButton onClick={submitTimesheet}>
          Submit for Approval
        </SubmitButton>
      </Header>
      
      <TimesheetGrid>
        <thead>
          <tr>
            <th>Task</th>
            {weekDays.map(day => (
              <th key={day}>{formatDay(day)}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {timesheet.tasks.map(task => (
            <tr key={task.id}>
              <td>
                <TaskLink to={`/tasks/${task.key}`}>
                  {task.key}: {task.title}
                </TaskLink>
              </td>
              {weekDays.map(day => (
                <td key={day}>
                  <DurationCell
                    value={task.logsByDay[day]}
                    onChange={v => updateLog(task.id, day, v)}
                    editable={!timesheet.submitted}
                  />
                </td>
              ))}
              <td>
                <strong>{task.weekTotal}h</strong>
              </td>
            </tr>
          ))}
          
          <tr className="total-row">
            <td><strong>Daily Total</strong></td>
            {weekDays.map(day => (
              <td key={day}>
                <strong>{timesheet.dailyTotals[day]}h</strong>
              </td>
            ))}
            <td>
              <strong>{totalHours}h</strong>
            </td>
          </tr>
        </tbody>
      </TimesheetGrid>
      
      {timesheet.submitted && (
        <SubmissionStatus status={timesheet.approvalStatus}>
          {timesheet.approvalStatus === 'pending' && (
            <>Submitted on {timesheet.submittedAt} — Pending approval</>
          )}
          {timesheet.approvalStatus === 'approved' && (
            <>Approved by {timesheet.approvedBy.name} on {timesheet.approvedAt}</>
          )}
          {timesheet.approvalStatus === 'rejected' && (
            <>
              Rejected: {timesheet.rejectionReason}
              <Button onClick={openTimesheet}>Edit & Resubmit</Button>
            </>
          )}
        </SubmissionStatus>
      )}
    </TimesheetContainer>
  );
};
```

---

**4.4.3 Billing & Time Reports**

```jsx
const BillingReport = ({ projectId, dateRange }) => {
  const { report } = useBillingReport(projectId, dateRange);
  
  return (
    <ReportContainer>
      <ReportHeader>
        <h2>Project Billing Report</h2>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <ExportButton reportType="billing" />
      </ReportHeader>
      
      <Summary>
        <SummaryCard>
          <Label>Total Hours</Label>
          <Value>{report.totalHours}h</Value>
        </SummaryCard>
        <SummaryCard>
          <Label>Billable Hours</Label>
          <Value>{report.billableHours}h</Value>
        </SummaryCard>
        <SummaryCard>
          <Label>Total Cost</Label>
          <Value>${report.totalCost}</Value>
        </SummaryCard>
        <SummaryCard>
          <Label>Total Billed</Label>
          <Value>${report.totalBilled}</Value>
        </SummaryCard>
      </Summary>
      
      <BreakdownByUser>
        <h3>By Team Member</h3>
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Hours</th>
              <th>Rate</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {report.byUser.map(u => (
              <tr key={u.userId}>
                <td>{u.name}</td>
                <td>{u.role}</td>
                <td>{u.hours}h</td>
                <td>${u.rate}/h</td>
                <td>${u.cost}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </BreakdownByUser>
      
      <BreakdownByTask>
        <h3>By Task</h3>
        <Table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Assigned To</th>
              <th>Estimated</th>
              <th>Logged</th>
              <th>Variance</th>
            </tr>
          </thead>
          <tbody>
            {report.byTask.map(t => (
              <tr key={t.taskId}>
                <td>
                  <TaskLink to={`/tasks/${t.key}`}>
                    {t.key}: {t.title}
                  </TaskLink>
                </td>
                <td>{t.assignee}</td>
                <td>{t.estimatedHours}h</td>
                <td>{t.loggedHours}h</td>
                <td className={t.variance > 0 ? 'over' : 'under'}>
                  {t.variance > 0 ? '+' : ''}{t.variance}h
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </BreakdownByTask>
    </ReportContainer>
  );
};
```

**Testing:**
- [ ] Start timer on task
- [ ] Timer persists across page refresh
- [ ] Stop timer → time log created
- [ ] Log time manually
- [ ] Edit existing time log
- [ ] Weekly timesheet shows all logs
- [ ] Submit timesheet for approval
- [ ] Manager approves/rejects timesheet
- [ ] Billing report calculates correctly
- [ ] Export billing report as CSV
- [ ] Time log visible on task detail

---

### Wave 4 Success Metrics

| Metric | Target | Validation |
|--------|--------|------------|
| All 7 reports implemented | 100% | Feature audit |
| CSV/PDF export working | 100% | Export test |
| Visual asset preview usage | 70% of design tasks have visual attachments | Analytics |
| Client portal feedback submitted | 5+ feedback items in first week | Client usage |
| Time tracking adoption | 80% of team logs time daily | Time log data |
| Billing report accuracy | 100% matches manual calculation | Audit |

---

## Beyond Jira: Competitive Differentiators

### Why These Features Matter

| Feature | Jira | Nexora | Impact for PixelCraft |
|---------|------|--------|----------------------|
| **Visual Asset Preview** | ❌ Plain attachment links | ✅ Image gallery, Figma embeds | Designers save 30min/day not downloading files |
| **Client Feedback Portal** | ⚠️ Requires full license | ✅ Dedicated portal, no Jira complexity | Client pays $0 instead of $7/month |
| **Built-in Time Tracking** | ❌ Requires Tempo ($5/user/mo) | ✅ Native, free | Save ₹90K/year on Tempo |
| **India-Optimized Performance** | ⚠️ 300-500ms latency | ✅ <100ms (Mumbai region) | 5x faster response time |
| **Pricing** | $7/user × 18 = $126/mo | $4/user × 18 = $72/mo | Save $648/year (51% cheaper) |

---

## Testing Strategy & Simulation Plan

### Simulation Design Philosophy

**Realistic Usage Over Scripted Scenarios**

Instead of "Admin creates project, adds 3 tasks, done," we simulate:
- 10 consecutive working days of PixelCraft using Nexora
- Multiple concurrent users
- Real Jira workflows (sprint planning, daily standups, sprint review)
- Edge cases and failure recovery
- Performance under load

---

### Simulation Timeline: 10-Day Sprint

#### Day 1 (Monday) — Sprint Planning

**Time:** 9:00 AM - 11:00 AM

**Participants:**
- Aditya (Game Director)
- Kavya (Engineering Lead)
- Anjali (Scrum Master)
- Entire DQM team (12 members)

**Actions:**
1. Anjali creates Sprint 24
2. Team reviews backlog (47 items)
3. Team drags 23 items into sprint
4. Each item assigned story points (Fibonacci)
5. Sprint committed points: 55
6. Kavya assigns tasks to developers
7. Sprint start confirmed

**Expected System Behavior:**
- [ ] Sprint created with start/end dates
- [ ] 23 items moved to sprint
- [ ] Total sprint points calculated (55)
- [ ] Each task assigned to team member
- [ ] Sprint status: Active
- [ ] Board shows sprint 24 view
- [ ] Burndown chart initialized (Day 0 = 55 points)

**Simulation Script:**
```javascript
// Day 1 simulation
const sprint24 = await createSprint({
  name: 'Sprint 24',
  startDate: '2026-04-01',
  endDate: '2026-04-14',
  goal: 'Complete Level 3 gameplay + Fix critical bugs'
});

const backlogItems = await getBacklog('DQM');
const selectedItems = backlogItems.slice(0, 23);

for (const item of selectedItems) {
  await addItemToSprint(item.id, sprint24.id);
  await assignStoryPoints(item.id, getRandomFibonacci());
  await assignTask(item.id, getRandomDeveloper());
}

await startSprint(sprint24.id);
```

---

#### Day 2 (Tuesday) — Daily Standup + Active Development

**Time:** 10:00 AM

**Participants:** Entire DQM team

**Actions:**
1. Each member updates their tasks on board
2. Rohan moves 3 tasks from "To Do" → "In Progress"
3. Shreya moves 1 task to "In Review"
4. Arjun logs time on DQM-234 (3.5 hours)
5. Naina discovers bug, creates DQM-301 with:
   - Type: Bug
   - Priority: High
   - Environment: Staging
   - Steps to reproduce (detailed)
   - Screenshots attached
6. Kavya assigns DQM-301 to Rohan
7. Priya (Game Designer) attaches Figma mockup to DQM-287
8. Team comments on 12 tasks

**Expected System Behavior:**
- [ ] Board updates real-time as tasks move
- [ ] Burndown chart updates (55 → 50 points remaining)
- [ ] Time log recorded on DQM-234
- [ ] Bug DQM-301 created with all required fields
- [ ] Rohan receives assignment notification
- [ ] Figma embed renders in DQM-287
- [ ] 12 comment notifications sent
- [ ] @mentions trigger notifications

**Simulation Script:**
```javascript
// Day 2 simulation
await moveTasks([
  { id: 'DQM-250', from: 'To Do', to: 'In Progress' },
  { id: 'DQM-251', from: 'To Do', to: 'In Progress' },
  { id: 'DQM-252', from: 'To Do', to: 'In Progress' },
  { id: 'DQM-245', from: 'In Progress', to: 'In Review' }
]);

await logTime('DQM-234', {
  userId: 'arjun',
  duration: 210, // minutes
  date: '2026-04-02',
  description: 'Implemented player inventory API'
});

const bug = await createTask({
  projectId: 'DQM',
  type: 'bug',
  title: 'Player health resets on level transition',
  priority: 'high',
  environment: 'staging',
  stepsToReproduce: `
1. Complete Level 2
2. Transition to Level 3
3. Observe player health bar
  `,
  expectedBehavior: 'Health should carry over',
  actualBehavior: 'Health resets to 100%',
  reporter: 'naina',
  assignee: 'rohan'
});

await uploadAttachment('DQM-287', {
  type: 'figma',
  url: 'https://figma.com/file/abc123/Level-3-UI'
});

// Simulate 12 comments with @mentions
for (let i = 0; i < 12; i++) {
  await addComment(getRandomTask(), {
    text: `@[Kavya Rao](user:kavya-id) can you review this?`,
    author: getRandomDeveloper()
  });
}
```

---

#### Day 3 (Wednesday) — Client Feedback via Portal

**Time:** 2:00 PM

**Participant:** Maya Chen (DreamGames Corp client)

**Actions:**
1. Maya logs into client portal
2. Reviews Sprint 23 completion (milestone 4)
3. Submits feedback:
   - Type: Bug
   - Title: "Dragon fire animation looks choppy on iPhone 12"
   - Priority: High
   - Uploads video recording (12 MB)
4. Submits feature request:
   - Type: Feature
   - Title: "Add Russian language support"
   - Priority: Medium

**Expected System Behavior:**
- [ ] Maya can access portal without Nexora account
- [ ] Milestone 4 shows 92% complete
- [ ] Bug feedback creates task: DQM-302 [CLIENT]
- [ ] Feature request creates task: DQM-303 [CLIENT]
- [ ] Video upload processed and thumbnail generated
- [ ] Kavya receives notification of new client feedback
- [ ] Maya receives confirmation email

**Simulation Script:**
```javascript
// Day 3 simulation (client portal)
const clientFeedback1 = await clientPortal.submitFeedback({
  projectId: 'DQM',
  clientUserId: 'maya-chen',
  type: 'bug',
  title: 'Dragon fire animation looks choppy on iPhone 12',
  description: 'When dragon breathes fire, the animation stutters on iPhone 12 Pro Max running iOS 17.2',
  priority: 'high',
  attachments: [
    { file: 'dragon-fire-bug.mp4', size: 12000000 }
  ]
});

const clientFeedback2 = await clientPortal.submitFeedback({
  projectId: 'DQM',
  clientUserId: 'maya-chen',
  type: 'feature',
  title: 'Add Russian language support',
  description: 'We want to launch in Russian market. Need full UI translation.',
  priority: 'medium'
});

// Verify task creation
const task302 = await getTask('DQM-302');
assert(task302.labels.includes('client-feedback'));
assert(task302.title.startsWith('[CLIENT]'));
```

---

#### Day 4 (Thursday) — Code Review & Collaboration

**Time:** Throughout day

**Actions:**
1. Shreya (QA) creates 5 bugs from regression testing
2. Rohan moves DQM-250 to "In Review"
3. Kavya reviews DQM-250, leaves comment:
   "@[Rohan Deshmukh](user:rohan-id) Good work! One concern about the error handling on line 142. Can you add a try-catch block?"
4. Rohan addresses feedback, responds:
   "@[Kavya Rao](user:kavya-id) Fixed! Added error handling + unit test."
5. Kavya approves, moves DQM-250 to "Done"
6. 8 tasks marked as done today
7. Burndown chart updates (50 → 35 points)

**Expected System Behavior:**
- [ ] 5 bugs created with QA reporter
- [ ] Task status changes trigger notifications
- [ ] @mentions in comments notify users real-time
- [ ] Comment thread preserved in order
- [ ] Done tasks move off sprint board
- [ ] Burndown chart shows progress
- [ ] Velocity tracking updated

**Simulation Script:**
```javascript
// Day 4 simulation
const qaBugs = [
  'Shop page crashes when buying 100 items',
  'Leaderboard shows duplicate entries',
  'Sound effects cut off on Android 10',
  'Tutorial skips step 3',
  'Profile picture upload fails for PNG'
];

for (const bugTitle of qaBugs) {
  await createTask({
    projectId: 'DQM',
    type: 'bug',
    title: bugTitle,
    priority: 'medium',
    reporter: 'shreya',
    environment: 'staging'
  });
}

await moveTask('DQM-250', 'In Review');

await addComment('DQM-250', {
  author: 'kavya',
  text: '@[Rohan Deshmukh](user:rohan-id) Good work! One concern about error handling...'
});

// Rohan responds
await addComment('DQM-250', {
  author: 'rohan',
  text: '@[Kavya Rao](user:kavya-id) Fixed! Added error handling + unit test.'
});

await moveTask('DQM-250', 'Done');

// Mark 7 more tasks as done
const tasksToComplete = await getTasksInStatus('In Review');
for (const task of tasksToComplete.slice(0, 7)) {
  await moveTask(task.id, 'Done');
}
```

---

#### Day 5 (Friday) — Time Tracking & Filters

**Time:** Throughout day

**Actions:**
1. Team logs time on tasks (simulating real work)
2. Arjun logs 6.5 hours on DQM-260
3. Vikram uses board filters:
   - Filter by assignee: Vikram
   - Shows 4 tasks
4. Vikram switches to swimlane view by Epic
5. Meera (UI Designer) uploads 12 UI mockups to DQM-275
6. All mockups generate thumbnails
7. Nikhil (PM) exports velocity report as CSV

**Expected System Behavior:**
- [ ] Time logs recorded for 15+ tasks
- [ ] Total time tracked: 78 hours for the day
- [ ] Board filters work instantly
- [ ] Swimlane view groups by epic correctly
- [ ] 12 image thumbnails generated
- [ ] CSV export downloads with correct data

**Simulation Script:**
```javascript
// Day 5 simulation
const team = getDevelopmentTeam();

for (const member of team) {
  const hours = Math.random() * 6 + 2; // 2-8 hours
  await logTime(getRandomActiveTask(member), {
    userId: member.id,
    duration: hours * 60,
    date: '2026-04-05',
    description: 'Development work'
  });
}

// Vikram filters board
const filteredTasks = await getBoardTasks('DQM', {
  filters: { assignee: 'vikram' }
});
assert(filteredTasks.every(t => t.assignee === 'vikram'));

// Meera uploads UI mockups
const mockups = generateMockImageFiles(12);
for (const mockup of mockups) {
  await uploadAttachment('DQM-275', mockup);
}

// Verify thumbnails generated
const task275 = await getTask('DQM-275');
assert(task275.attachments.every(a => a.thumbnailUrl));

// PM exports velocity report
const csvData = await exportReport('velocity', {
  projectId: 'DQM',
  format: 'csv'
});
assert(csvData.includes('Sprint 24'));
```

---

#### Day 6-9 (Weekend + Mon-Tue) — Continued Development

**Actions:**
- Team continues moving tasks through workflow
- 30+ tasks completed over 4 days
- Sprint points remaining: 35 → 12
- Multiple @mentions, comments, time logs
- Client portal checked daily by Maya

**Simulation:** Repeat Day 2-5 patterns with variation

---

#### Day 10 (Wednesday) — Sprint Review & Completion

**Time:** 3:00 PM

**Participants:** Full team + Maya (client, via video)

**Actions:**
1. Anjali prepares sprint completion
2. 3 tasks remain incomplete (12 points)
3. Anjali clicks "Complete Sprint"
4. Modal appears with incomplete items
5. Anjali selects: "Move to Backlog"
6. Sprint 24 marked complete
7. Velocity recorded: 43 points
8. Team creates Sprint 25
9. Maya approves milestone in client portal

**Expected System Behavior:**
- [ ] Sprint completion modal shows 3 incomplete items
- [ ] Items successfully moved to backlog
- [ ] Sprint status: Closed
- [ ] Velocity chart updated with Sprint 24 (43 points)
- [ ] Sprint 25 created and ready
- [ ] Client portal milestone auto-updates

**Simulation Script:**
```javascript
// Day 10 simulation
const sprint24 = await getSprint('Sprint 24');
const incompleteItems = await getIncompleteSprintItems(sprint24.id);

assert(incompleteItems.length === 3);
assert(sprint24.remainingPoints === 12);

await completeSprint(sprint24.id, {
  incompleteAction: 'backlog',
  incompleteItemIds: incompleteItems.map(i => i.id)
});

// Verify completion
const completedSprint = await getSprint('Sprint 24');
assert(completedSprint.status === 'closed');
assert(completedSprint.velocity === 43);

// Verify velocity chart
const velocityData = await getVelocityReport('DQM');
const sprint24Data = velocityData.sprints.find(s => s.name === 'Sprint 24');
assert(sprint24Data.completedPoints === 43);

// Incomplete items moved to backlog
for (const item of incompleteItems) {
  const task = await getTask(item.id);
  assert(task.sprint === null);
  assert(task.status === 'To Do');
}

// Create Sprint 25
const sprint25 = await createSprint({
  name: 'Sprint 25',
  startDate: '2026-04-15',
  endDate: '2026-04-28',
  goal: 'Complete Level 4 + Polish Level 3'
});
```

---

### Load Testing & Performance

**Concurrent Users Test:**
```javascript
// Simulate 18 users active simultaneously
const users = getPixelCraftTeam();

await Promise.all(users.map(async (user) => {
  // Each user performs 5 actions
  await login(user);
  await viewBoard('DQM');
  await moveRandomTask();
  await addComment(getRandomTask());
  await logTime(getRandomTask(), {
    duration: Math.random() * 120 + 30
  });
}));
```

**Expected Performance:**
- [ ] Page load time: <500ms (board view)
- [ ] Task status update: <200ms
- [ ] Real-time notification delivery: <100ms
- [ ] Comment submission: <300ms
- [ ] File upload (5MB): <3s
- [ ] Report generation: <2s
- [ ] Concurrent 18 users: No degradation

---

### Edge Case Testing

**Scenario 1: Network Failure Recovery**
```javascript
// User moves task, loses network, regains network
await moveTask('DQM-100', 'In Progress');
simulateNetworkDisconnect();
await wait(5000);
simulateNetworkReconnect();

// Expected: Task move retried, notification sent
const task = await getTask('DQM-100');
assert(task.status === 'In Progress');
```

**Scenario 2: Concurrent Edits**
```javascript
// Two users edit same task simultaneously
await Promise.all([
  updateTask('DQM-100', { title: 'New Title A' }, user1),
  updateTask('DQM-100', { title: 'New Title B' }, user2)
]);

// Expected: Last write wins, both users notified of conflict
```

**Scenario 3: Sprint Close with Active Timers**
```javascript
// User has active timer when sprint closes
await startTimer('DQM-100', userId);
await completeSprint(sprintId);

// Expected: Timer stopped automatically, time logged
const task = await getTask('DQM-100');
assert(task.timeLogs.length > 0);
```

---

## Acceptance Criteria Matrix

### Wave 1 Acceptance Criteria

| Feature | Acceptance Criteria | Status |
|---------|---------------------|--------|
| JWT Security | ✅ Tokens in httpOnly cookies<br>✅ XSS attack simulation fails<br>✅ CSRF protection enabled | ⬜ |
| RBAC | ✅ All 47 routes have permission checks<br>✅ Viewer cannot create tasks (403)<br>✅ Member cannot delete project (403) | ⬜ |
| Sprint Close | ✅ Modal shows incomplete items<br>✅ Items move to backlog/next sprint<br>✅ Velocity calculated correctly | ⬜ |
| Reporter Field | ✅ All tasks have reporter<br>✅ Reporter immutable after creation<br>✅ Migration script successful | ⬜ |
| Charts | ✅ Burndown renders on frontend<br>✅ Velocity chart shows 6 sprints<br>✅ Data updates real-time | ⬜ |

### Wave 2 Acceptance Criteria

| Feature | Acceptance Criteria | Status |
|---------|---------------------|--------|
| @Mentions | ✅ Dropdown appears on typing @<br>✅ Mention creates notification<br>✅ Notification delivered <100ms<br>✅ 80% of team uses in first week | ⬜ |
| Board Filters | ✅ Filter by assignee works<br>✅ Multiple filters combine (AND)<br>✅ Filters persist across refresh<br>✅ 60% of board views use filters | ⬜ |
| Swimlanes | ✅ Swimlane by assignee groups correctly<br>✅ Drag between swimlanes updates assignee<br>✅ 50% of boards use swimlanes | ⬜ |
| WIP Limits | ✅ WIP indicator shows current/limit<br>✅ Cannot drag into full column (hard limit)<br>✅ 90% WIP compliance | ⬜ |

### Wave 3 Acceptance Criteria

| Feature | Acceptance Criteria | Status |
|---------|---------------------|--------|
| Project Roles | ✅ User can be admin on Project A, developer on Project B<br>✅ Task assignment validates project membership<br>✅ Migration successful | ⬜ |
| Issue Cloning | ✅ Clone within project works<br>✅ Clone to different project changes key<br>✅ 20% of team uses in first week | ⬜ |
| Templates | ✅ Template pre-fills all fields<br>✅ 5+ templates created per project | ⬜ |
| Visibility | ✅ Private project blocks non-members (403)<br>✅ 0 unauthorized access attempts | ⬜ |
| Components | ✅ Component auto-assigns tasks<br>✅ 60% of projects use components | ⬜ |

### Wave 4 Acceptance Criteria

| Feature | Acceptance Criteria | Status |
|---------|---------------------|--------|
| All Reports | ✅ CFD, Control Chart, Epic Progress implemented<br>✅ CSV/PDF export works for all reports | ⬜ |
| Asset Preview | ✅ Image thumbnails generated<br>✅ Figma embeds render<br>✅ 70% of design tasks have visual attachments | ⬜ |
| Client Portal | ✅ Client can submit feedback<br>✅ Feedback creates tagged task<br>✅ 5+ feedback items in first week | ⬜ |
| Time Tracking | ✅ Timer persists across refresh<br>✅ Weekly timesheet accurate<br>✅ 80% of team logs time daily<br>✅ Billing report matches manual calculation | ⬜ |

---

## Pain Point Resolution Map

### PixelCraft's Pain Points → Nexora Solutions

| Pain Point | Impact | Nexora Solution | Wave |
|------------|--------|-----------------|------|
| **Jira is expensive** ($126/mo) | High | Nexora: $72/mo (43% cheaper) | N/A |
| **Slow from India** (300-500ms) | High | Mumbai region deployment (<100ms) | Pre-launch |
| **Tempo costs extra** ($90/year) | Medium | Built-in time tracking (free) | Wave 4 |
| **Client needs access but Jira is confusing** | High | Dedicated client portal (no Jira complexity) | Wave 4 |
| **Design files are plain links** | Medium | Rich asset preview (images, Figma, video) | Wave 4 |
| **Over-engineered, hard to onboard** | Medium | Simplified UI, progressive disclosure | All waves |
| **@Mentions don't notify fast enough** | Medium | Real-time WebSocket notifications (<100ms) | Wave 2 |
| **Can't see who's working on what** | Low | Swimlanes by assignee | Wave 2 |
| **No bulk invite** | Low | CSV bulk invite | Wave 3 |
| **Reporting is slow** | Medium | All reports with export (CSV/PDF) | Wave 4 |

---

## Success Metrics Summary

### Pre-Launch (Current State)
- Adoption Readiness: 5.0/10
- P0 Blockers: 7
- Revenue: $0

### Post-Wave 4 (8 Weeks)
- Adoption Readiness: **8.5/10**
- P0 Blockers: **0**
- P1 Gaps Resolved: **11/11**
- Competitive Differentiators: **3**
- Estimated Revenue: **$72/month from PixelCraft** (first customer)
- Expansion Potential: 50+ person organizations

### Key Performance Indicators (Week 1 Post-Launch)

| KPI | Target | Measurement |
|-----|--------|-------------|
| Daily Active Users | 80% of team (14/18) | Login analytics |
| Tasks Created | 50+ tasks/week | Database count |
| @Mention Usage | 80% of team | Notification logs |
| Time Tracking Adoption | 80% of team logs daily | Time log data |
| Client Portal Usage | 5+ feedback items | Client portal analytics |
| Board Filter Usage | 60% of board views | Feature analytics |
| Sprint Completion Success | 100% (no errors) | Error logs |
| System Uptime | 99.9% | Infrastructure monitoring |
| Page Load Time | <500ms (p95) | APM tools |
| User Satisfaction | 8.0/10 | Post-sprint survey |

---

## Implementation Checklist

### Wave 1 (Weeks 1-2) Deliverables
- [ ] JWT migrated to httpOnly cookies
- [ ] Frontend RBAC guards on all routes
- [ ] Sprint completion modal with incomplete-item handling
- [ ] Reporter field on all task types (+ migration)
- [ ] Burndown chart rendering on frontend
- [ ] Velocity chart rendering on frontend
- [ ] Security audit passed (XSS, CSRF, RBAC)

### Wave 2 (Weeks 3-4) Deliverables
- [ ] @Mention in comments with dropdown
- [ ] Real-time notifications (WebSocket)
- [ ] Board filters (assignee, label, sprint, type, priority)
- [ ] Swimlanes (by assignee, epic, priority)
- [ ] WIP limits on Kanban boards
- [ ] Environment, Steps to Reproduce, Acceptance Criteria fields
- [ ] Notification bell with unread count

### Wave 3 (Weeks 5-6) Deliverables
- [ ] Per-project role assignment
- [ ] Issue cloning (same project & cross-project)
- [ ] Task templates
- [ ] Project visibility controls (public/private/restricted)
- [ ] Components with auto-assignment
- [ ] Fix Version & Release management
- [ ] Bulk CSV member invite

### Wave 4 (Weeks 7-8) Deliverables
- [ ] Cumulative Flow Diagram
- [ ] Control Chart (cycle time)
- [ ] Epic Progress Report
- [ ] CSV/PDF export for all reports
- [ ] Visual asset preview (images, Figma, video)
- [ ] Client feedback portal
- [ ] Built-in time tracking (timer, manual log, weekly timesheet)
- [ ] Billing & time reports

---

## Next Steps

1. **Review & Approve Plan** — Confirm wave priorities and timeline
2. **Allocate Resources** — Assign backend/frontend developers to waves
3. **Set Up Simulation Environment** — Create PixelCraft test organization
4. **Wave 1 Kickoff** — Security hardening sprint begins
5. **Daily Standups** — Track progress against acceptance criteria
6. **Weekly Demos** — Show working features to stakeholders
7. **Post-Wave 4 Launch** — Onboard PixelCraft Studios as first customer

---

**End of Implementation Plan**

*Ready for execution. Questions or adjustments needed?*
