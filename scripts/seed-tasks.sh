#!/bin/bash
# DEV_ONLY: Seed script for sample tasks with descriptions
# Prerequisites: seed-users.sh must have been run first
# Usage: bash scripts/seed-tasks.sh [PROJECT_ID]
#   If PROJECT_ID is not provided, the script will create a sample project first.

API="http://localhost:3005/api/v1"

echo "=== Seed Tasks ==="

# ── 1. Login as admin ──
echo "Logging in as admin..."
TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nexora.io","password":"Admin@123456"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Could not obtain auth token. Make sure the stack is running and admin user exists."
  exit 1
fi
echo "  Token obtained."

# ── 2. Resolve project ──
PROJECT_ID="${1:-}"

if [ -z "$PROJECT_ID" ]; then
  echo ""
  echo "No PROJECT_ID provided — creating a sample project..."
  PROJECT_RESP=$(curl -s -X POST "$API/projects" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
      "projectName": "Nexora Platform",
      "projectKey": "NXP",
      "description": "Core platform development for Nexora — HR, attendance, projects and task management.",
      "status": "active",
      "priority": "high",
      "category": "web",
      "methodology": "scrum",
      "startDate": "2026-01-01",
      "endDate": "2026-06-30"
    }')
  PROJECT_ID=$(echo "$PROJECT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('_id','') or d.get('_id',''))" 2>/dev/null)

  if [ -z "$PROJECT_ID" ]; then
    echo "ERROR: Failed to create project. Response: $PROJECT_RESP"
    exit 1
  fi
  echo "  Created project: $PROJECT_ID"
fi

echo ""
echo "Seeding tasks for project: $PROJECT_ID"
echo ""

# Helper to create a task and print the result
create_task() {
  local label="$1"
  local payload="$2"
  RESP=$(curl -s -X POST "$API/tasks" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$payload")
  TASK_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('_id','') or d.get('_id',''))" 2>/dev/null)
  if [ -n "$TASK_ID" ]; then
    echo "  [OK] $label -> $TASK_ID"
  else
    echo "  [FAIL] $label: $RESP"
  fi
  echo "$TASK_ID"
}

# ── 3. Create Epics ──
echo "Creating epics..."
EPIC_AUTH_ID=$(create_task "Epic: Authentication System" "$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "projectKey": "NXP",
  "title": "Authentication & Authorization System",
  "description": "<h2>Authentication System</h2><h3>Objective</h3><p>Build a complete authentication and authorization layer for the Nexora platform, supporting email/OTP login, OAuth (Google, Microsoft), SAML SSO, and MFA.</p><h3>Scope</h3><ul><li><p>OTP-based passwordless login</p></li><li><p>Google &amp; Microsoft OAuth 2.0</p></li><li><p>SAML SSO for enterprise clients</p></li><li><p>TOTP-based MFA (speakeasy)</p></li><li><p>JWT access + refresh tokens</p></li><li><p>Account lockout after 5 failed attempts</p></li></ul><h3>Acceptance Criteria</h3><ul data-type=\"taskList\"><li data-type=\"taskItem\" data-checked=\"false\"><p>Users can log in via email OTP</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>OAuth buttons work for Google &amp; Microsoft</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>MFA can be enabled/disabled from settings</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>Token refresh works transparently</p></li></ul>",
  "type": "epic",
  "status": "in_progress",
  "priority": "critical",
  "storyPoints": 21,
  "labels": ["auth", "security", "backend"]
}
EOF
)")

EPIC_HR_ID=$(create_task "Epic: HR Management" "$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "projectKey": "NXP",
  "title": "HR Management Module",
  "description": "<h2>HR Management Module</h2><h3>Overview</h3><p>Centralised HR management covering employee records, departments, designations, and teams. Replaces manual spreadsheets and fragmented HR tools.</p><h3>Key Features</h3><ol><li><p>Employee directory with auto-generated NXR-XXXX IDs</p></li><li><p>Department &amp; designation hierarchy (levels 1–10)</p></li><li><p>Team groupings with lead assignment</p></li><li><p>Org chart view</p></li><li><p>Role-based access — only admin/hr can create/edit employees</p></li></ol><h3>Non-Goals</h3><ul><li><p>Payroll processing (separate module)</p></li><li><p>Performance reviews (Q3 scope)</p></li></ul>",
  "type": "epic",
  "status": "done",
  "priority": "high",
  "storyPoints": 13,
  "labels": ["hr", "employees", "backend"]
}
EOF
)")

EPIC_PROJECTS_ID=$(create_task "Epic: Projects & Tasks" "$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "projectKey": "NXP",
  "title": "Projects & Task Management",
  "description": "<h2>Projects &amp; Task Management</h2><h3>Vision</h3><p>A Jira-like project management module that supports Scrum, Kanban, Scrumban, and Waterfall methodologies with full sprint lifecycle management.</p><h3>Item Types</h3><ul><li><p><strong>Epic</strong> — Large body of work (contains stories)</p></li><li><p><strong>Story</strong> — User-facing feature</p></li><li><p><strong>Task</strong> — General work item</p></li><li><p><strong>Bug</strong> — Defect requiring fix</p></li><li><p><strong>Sub-task</strong> — Child of story/task</p></li><li><p><strong>Improvement</strong> — Enhancement to existing feature</p></li><li><p><strong>Spike</strong> — Time-boxed research</p></li></ul><h3>Board Types</h3><ul><li><p><strong>Kanban</strong> — Continuous flow with WIP limits</p></li><li><p><strong>Scrum</strong> — Sprint-based with velocity tracking and burndown</p></li></ul>",
  "type": "epic",
  "status": "in_progress",
  "priority": "high",
  "storyPoints": 21,
  "labels": ["projects", "tasks", "boards", "sprints"]
}
EOF
)")

# ── 4. Create Stories ──
echo ""
echo "Creating stories..."

STORY_LOGIN_ID=$(create_task "Story: OTP Login Flow" "$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "projectKey": "NXP",
  "parentTaskId": "$EPIC_AUTH_ID",
  "title": "OTP-only login flow",
  "description": "<h2>User Story</h2><p><strong>As a</strong> registered user<br><strong>I want</strong> to log in using a one-time passcode sent to my email<br><strong>So that</strong> I don't need to remember a password</p><h3>Acceptance Criteria</h3><ul data-type=\"taskList\"><li data-type=\"taskItem\" data-checked=\"true\"><p>Login page shows email input only</p></li><li data-type=\"taskItem\" data-checked=\"true\"><p>After submitting email, OTP input appears inline</p></li><li data-type=\"taskItem\" data-checked=\"true\"><p>In dev environment OTP is always <code>000000</code></p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>Invalid OTP shows clear error message</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>OTP expires after 10 minutes</p></li></ul><h3>Notes</h3><p>New users are created inline — no separate registration page needed.</p>",
  "type": "story",
  "status": "done",
  "priority": "critical",
  "storyPoints": 8,
  "labels": ["auth", "frontend", "otp"]
}
EOF
)")

STORY_KANBAN_ID=$(create_task "Story: Kanban Board" "$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "projectKey": "NXP",
  "parentTaskId": "$EPIC_PROJECTS_ID",
  "title": "Kanban board with WIP limits",
  "description": "<h2>User Story</h2><p><strong>As a</strong> project manager<br><strong>I want</strong> a Kanban board with configurable WIP limits per column<br><strong>So that</strong> the team can visualize and manage work-in-progress effectively</p><h3>Acceptance Criteria</h3><ul data-type=\"taskList\"><li data-type=\"taskItem\" data-checked=\"true\"><p>Board displays columns matching workflow stages</p></li><li data-type=\"taskItem\" data-checked=\"true\"><p>Cards can be dragged between columns</p></li><li data-type=\"taskItem\" data-checked=\"true\"><p>WIP exceeded shows amber warning</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>Column background turns amber when WIP is at limit</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>Admin can configure WIP limit per column in board settings</p></li></ul>",
  "type": "story",
  "status": "in_progress",
  "priority": "high",
  "storyPoints": 5,
  "labels": ["kanban", "board", "frontend"]
}
EOF
)")

STORY_SPRINT_ID=$(create_task "Story: Sprint Planning" "$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "projectKey": "NXP",
  "parentTaskId": "$EPIC_PROJECTS_ID",
  "title": "Sprint planning and backlog management",
  "description": "<h2>User Story</h2><p><strong>As a</strong> scrum master<br><strong>I want</strong> to plan sprints by dragging backlog items into sprint slots<br><strong>So that</strong> the team has a clear goal each iteration</p><h3>Acceptance Criteria</h3><ul data-type=\"taskList\"><li data-type=\"taskItem\" data-checked=\"true\"><p>Planning view shows backlog on left, sprint on right</p></li><li data-type=\"taskItem\" data-checked=\"true\"><p>Drag from backlog to sprint assigns task to sprint</p></li><li data-type=\"taskItem\" data-checked=\"true\"><p>Sprint can be started/completed with one click</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>Velocity chart shows last 5 completed sprints</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>Burndown chart available in sprint detail view</p></li></ul>",
  "type": "story",
  "status": "in_progress",
  "priority": "high",
  "storyPoints": 8,
  "labels": ["scrum", "sprint", "planning"]
}
EOF
)")

# ── 5. Create Tasks & Bugs ──
echo ""
echo "Creating tasks and bugs..."

create_task "Task: JWT refresh endpoint" "$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "projectKey": "NXP",
  "parentTaskId": "$EPIC_AUTH_ID",
  "title": "Implement JWT refresh token endpoint",
  "description": "<h2>Technical Task</h2><h3>Objective</h3><p>Implement <code>POST /api/v1/auth/refresh</code> that accepts a valid refresh token and returns a new access token + refresh token pair.</p><h3>Technical Approach</h3><p>Use NestJS Passport with a dedicated <code>jwt-refresh</code> strategy. Store refresh token hash in Redis with a 7-day TTL.</p><h3>Implementation Steps</h3><ol><li><p>Add <code>RefreshTokenStrategy</code> in <code>auth/strategies/</code></p></li><li><p>Create <code>POST /auth/refresh</code> controller method</p></li><li><p>Store refresh token hash in Redis on login</p></li><li><p>Invalidate old refresh token on use (rotation)</p></li></ol><h3>Testing Plan</h3><ul data-type=\"taskList\"><li data-type=\"taskItem\" data-checked=\"true\"><p>Unit test token validation logic</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>Integration test full refresh flow</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>Test token rotation (old token rejected after refresh)</p></li></ul>",
  "type": "task",
  "status": "done",
  "priority": "high",
  "storyPoints": 3,
  "estimatedHours": 4,
  "labels": ["auth", "jwt", "backend"]
}
EOF
)"

create_task "Bug: Rich text HTML visible on edit" "$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "projectKey": "NXP",
  "title": "Rich text editor shows HTML tags when editing existing description",
  "description": "<h2>Bug Report</h2><h3>Description</h3><p>When opening an existing item to edit, the description field shows raw HTML tags (e.g. <code>&lt;p&gt;Hello&lt;/p&gt;</code>) instead of rendered rich text.</p><h3>Steps to Reproduce</h3><ol><li><p>Create an item with a description using the rich text editor</p></li><li><p>Save the item</p></li><li><p>Re-open the item for editing</p></li><li><p>Observe: description field is empty OR shows HTML source</p></li></ol><h3>Expected Behavior</h3><p>The rich text editor should render the saved HTML content as formatted text.</p><h3>Actual Behavior</h3><p>The editor shows empty content or raw HTML tags because <code>useEditor</code> initializes before async data loads and does not react to the <code>content</code> prop changing after initialization.</p><h3>Root Cause</h3><p>Tiptap's <code>useEditor</code> hook only uses <code>content</code> as the initial value. A <code>useEffect</code> is needed to call <code>editor.commands.setContent(content)</code> when the prop changes.</p><h3>Fix</h3><p>Added a <code>useEffect</code> in <code>RichTextEditor</code> that syncs the <code>content</code> prop to the editor whenever it changes externally.</p>",
  "type": "bug",
  "status": "done",
  "priority": "high",
  "storyPoints": 1,
  "labels": ["frontend", "rich-text", "editor", "bug"]
}
EOF
)"

create_task "Task: Seed data for development" "$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "projectKey": "NXP",
  "title": "Create seed scripts for all modules",
  "description": "<h2>Technical Task</h2><h3>Objective</h3><p>Provide ready-to-run seed scripts for all major data entities so developers can start with realistic data immediately after standing up the stack.</p><h3>Modules to Seed</h3><ul data-type=\"taskList\"><li data-type=\"taskItem\" data-checked=\"true\"><p><strong>Users</strong> — 5 users with different roles</p></li><li data-type=\"taskItem\" data-checked=\"true\"><p><strong>Roles</strong> — 7 roles with permission matrices</p></li><li data-type=\"taskItem\" data-checked=\"true\"><p><strong>Policies</strong> — Work timing, leave, WFH templates</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p><strong>Tasks</strong> — Sample epics, stories, tasks and bugs with rich descriptions</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p><strong>Employees</strong> — HR records linked to seeded users</p></li></ul><h3>Usage</h3><pre><code>bash scripts/seed-users.sh\nbash scripts/seed-roles.sh\nbash scripts/seed-policies.sh\nbash scripts/seed-tasks.sh</code></pre>",
  "type": "task",
  "status": "in_progress",
  "priority": "medium",
  "storyPoints": 2,
  "labels": ["devops", "seed", "dx"]
}
EOF
)"

create_task "Improvement: Team avatar fallback" "$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "projectKey": "NXP",
  "title": "Team member avatar shows ? when name/email missing",
  "description": "<h2>Improvement</h2><h3>Summary</h3><p>Project team member avatars display a literal <strong>?</strong> character when the member object has no <code>name</code> or <code>email</code> field. This looks broken.</p><h3>Proposed Solution</h3><p>Replace the <code>\"?\"</code> fallback with a generic person icon (SVG) when no initial character is available.</p><h3>Affected Components</h3><ul><li><p><code>frontend/src/app/projects/page.tsx</code> — project cards grid</p></li><li><p><code>frontend/src/app/projects/[id]/page.tsx</code> — project detail header</p></li></ul><h3>Acceptance Criteria</h3><ul data-type=\"taskList\"><li data-type=\"taskItem\" data-checked=\"false\"><p>No literal <code>?</code> visible in any avatar</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>Members with name show first-letter initial</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>Members without name/email show a person icon</p></li></ul>",
  "type": "improvement",
  "status": "done",
  "priority": "low",
  "storyPoints": 1,
  "labels": ["frontend", "ui", "avatar"]
}
EOF
)"

create_task "Spike: Evaluate real-time notifications" "$(cat <<EOF
{
  "projectId": "$PROJECT_ID",
  "projectKey": "NXP",
  "title": "Evaluate WebSocket vs SSE for real-time task notifications",
  "description": "<h2>Research Spike</h2><h3>Question</h3><p>Should we use WebSocket (Socket.IO) or Server-Sent Events (SSE) for real-time task updates and notifications in Nexora?</p><h3>Background</h3><p>Users need to see when tasks are assigned to them, comments are posted, or sprint status changes — without refreshing the page. The calling-service already uses Socket.IO; we need to decide whether to extend it or use a lighter approach for notifications.</p><h3>Approach</h3><ol><li><p>Review current Socket.IO usage in <code>calling-service</code></p></li><li><p>Prototype SSE endpoint in <code>api-gateway</code></p></li><li><p>Compare: latency, browser support, reconnection behaviour, server load</p></li></ol><h3>Time Box</h3><p><strong>4 hours</strong></p><h3>Expected Output</h3><ul data-type=\"taskList\"><li data-type=\"taskItem\" data-checked=\"false\"><p>Written recommendation document</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>Prototype code (whichever approach wins)</p></li><li data-type=\"taskItem\" data-checked=\"false\"><p>Decision recorded in architecture log</p></li></ul>",
  "type": "spike",
  "status": "backlog",
  "priority": "medium",
  "storyPoints": 3,
  "labels": ["websocket", "sse", "notifications", "research"]
}
EOF
)"

echo ""
echo "=== Done! Tasks seeded for project $PROJECT_ID ==="
echo "  Open http://localhost:3100/projects/$PROJECT_ID to view"
