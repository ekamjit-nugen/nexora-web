#!/bin/bash

# =============================================================================
# Nexora Jira-Style Seed Data Script
# Creates projects, boards, sprints, epics, stories, tasks, bugs, and comments
# across 3 projects with realistic Jira-like data
# =============================================================================

API="http://localhost:3005/api/v1"

echo "🚀 Nexora Jira Data Seed Script"
echo "================================"
echo ""

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

extract_id() {
  echo "$1" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4
}

check_id() {
  local id="$1"
  local label="$2"
  if [ -z "$id" ]; then
    echo "  ❌ Failed to create $label (no ID returned)"
    return 1
  else
    echo "  ✅ Created $label (id: $id)"
    return 0
  fi
}

# =============================================================================
# STEP 1: LOGIN — Get tokens for all 4 users
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Step 1: Authenticating users..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# OTP-based login helper (dev OTP is always 000000)
otp_login() {
  local EMAIL="$1"
  curl -s -X POST "$API/auth/send-otp" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\"}" > /dev/null
  local VERIFY_RESP
  VERIFY_RESP=$(curl -s -X POST "$API/auth/verify-otp" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"otp\":\"000000\"}")
  echo "$VERIFY_RESP" | grep -o '"accessToken":"[^"]*"' | head -1 | cut -d'"' -f4
}

# Login primary user (Varun)
ADMIN_TOKEN=$(otp_login "varun@gmail.com")
if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ varun@gmail.com login failed. Is the API gateway running at $API ?"
  exit 1
fi
echo "  ✅ Varun (varun@gmail.com) logged in"

# Use Varun's token for all roles (single-user seed)
DEV_TOKEN="$ADMIN_TOKEN"
DESIGNER_TOKEN="$ADMIN_TOKEN"
MANAGER_TOKEN="$ADMIN_TOKEN"
echo "  ✅ All roles assigned to Varun"

# =============================================================================
# STEP 2: GET USER IDs via /auth/me
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👤 Step 2: Fetching user IDs..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ADMIN_ME=$(curl -s "$API/auth/me" -H "Authorization: Bearer $ADMIN_TOKEN")
ADMIN_ID=$(echo "$ADMIN_ME" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$ADMIN_ID" ]; then
  # fallback: try "id" field
  ADMIN_ID=$(echo "$ADMIN_ME" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi
echo "  ✅ Admin ID: $ADMIN_ID"

DEV_ME=$(curl -s "$API/auth/me" -H "Authorization: Bearer $DEV_TOKEN")
DEV_ID=$(echo "$DEV_ME" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$DEV_ID" ]; then
  DEV_ID=$(echo "$DEV_ME" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi
echo "  ✅ Dev ID: $DEV_ID"

DESIGNER_ME=$(curl -s "$API/auth/me" -H "Authorization: Bearer $DESIGNER_TOKEN")
DESIGNER_ID=$(echo "$DESIGNER_ME" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$DESIGNER_ID" ]; then
  DESIGNER_ID=$(echo "$DESIGNER_ME" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi
echo "  ✅ Designer ID: $DESIGNER_ID"

MANAGER_ME=$(curl -s "$API/auth/me" -H "Authorization: Bearer $MANAGER_TOKEN")
MANAGER_ID=$(echo "$MANAGER_ME" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$MANAGER_ID" ]; then
  MANAGER_ID=$(echo "$MANAGER_ME" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi
echo "  ✅ Manager ID: $MANAGER_ID"

# =============================================================================
# COMPUTE RELATIVE DATES
# =============================================================================

# Sprint 1: 14 days ago to 7 days ago (completed)
# Sprint 2: 7 days ago to 7 days from now (active)
SPRINT1_START=$(date -v-14d +%Y-%m-%d 2>/dev/null || date -d "14 days ago" +%Y-%m-%d)
SPRINT1_END=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "7 days ago" +%Y-%m-%d)
SPRINT2_START=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "7 days ago" +%Y-%m-%d)
SPRINT2_END=$(date -v+7d +%Y-%m-%d 2>/dev/null || date -d "7 days" +%Y-%m-%d)
TODAY=$(date +%Y-%m-%d)
NEXT_MONTH=$(date -v+30d +%Y-%m-%d 2>/dev/null || date -d "30 days" +%Y-%m-%d)

echo ""
echo "  📅 Sprint 1: $SPRINT1_START → $SPRINT1_END (completed)"
echo "  📅 Sprint 2: $SPRINT2_START → $SPRINT2_END (active)"

# =============================================================================
# ██████████████████████████████████████████████████████████████████████████
# PROJECT 1: "Nexora Platform v2" — Scrum methodology
# ██████████████████████████████████████████████████████████████████████████
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 PROJECT 1: Nexora Platform v2 (Scrum)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

P1_RESP=$(curl -s -X POST "$API/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "projectName": "Nexora Platform v2",
    "description": "Next generation unified IT operations platform. Replacing 10+ SaaS tools with a single enterprise solution.",
    "methodology": "scrum",
    "priority": "high",
    "status": "active",
    "startDate": "'"$SPRINT1_START"'",
    "endDate": "'"$NEXT_MONTH"'",
    "tags": ["platform", "v2", "enterprise"],
    "settings": {
      "boardType": "scrum",
      "estimationUnit": "story_points",
      "enableTimeTracking": true,
      "enableSubtasks": true,
      "enableEpics": true,
      "enableSprints": true,
      "sprintDuration": 14
    }
  }')
P1_ID=$(extract_id "$P1_RESP")
check_id "$P1_ID" "Project 1: Nexora Platform v2"
if [ -z "$P1_ID" ]; then echo "  Response: $P1_RESP"; exit 1; fi

# ── Add team members to Project 1 ──
echo ""
echo "  👥 Adding team members to Project 1..."
curl -s -X POST "$API/projects/$P1_ID/team" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"userId":"'"$DEV_ID"'","role":"member","projectRole":"Senior Developer"}' > /dev/null
echo "    ✅ Dev added"
curl -s -X POST "$API/projects/$P1_ID/team" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"userId":"'"$DESIGNER_ID"'","role":"member","projectRole":"UI/UX Designer"}' > /dev/null
echo "    ✅ Designer added"
curl -s -X POST "$API/projects/$P1_ID/team" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"userId":"'"$MANAGER_ID"'","role":"manager","projectRole":"Project Manager"}' > /dev/null
echo "    ✅ Manager added"

# ── Create Scrum Board for Project 1 ──
echo ""
echo "  🗂️  Creating Scrum board..."
P1_BOARD_RESP=$(curl -s -X POST "$API/boards/from-template" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "projectId": "'"$P1_ID"'",
    "type": "scrum"
  }')
P1_BOARD_ID=$(extract_id "$P1_BOARD_RESP")
check_id "$P1_BOARD_ID" "Scrum Board for Project 1"
if [ -z "$P1_BOARD_ID" ]; then
  echo "  Response: $P1_BOARD_RESP"
  # Fallback: create board manually
  P1_BOARD_RESP=$(curl -s -X POST "$API/boards" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{
      "name": "Nexora Platform v2 Board",
      "projectId": "'"$P1_ID"'",
      "type": "scrum",
      "columns": [
        {"name":"Backlog","order":0,"key":"backlog","statusMapping":["backlog"]},
        {"name":"To Do","order":1,"key":"todo","statusMapping":["todo"],"isStartColumn":true},
        {"name":"In Progress","order":2,"key":"in_progress","statusMapping":["in_progress"]},
        {"name":"In Review","order":3,"key":"in_review","statusMapping":["in_review"]},
        {"name":"Done","order":4,"key":"done","statusMapping":["done"],"isDoneColumn":true}
      ]
    }')
  P1_BOARD_ID=$(extract_id "$P1_BOARD_RESP")
  check_id "$P1_BOARD_ID" "Scrum Board for Project 1 (manual)"
  if [ -z "$P1_BOARD_ID" ]; then echo "  Board fallback response: $P1_BOARD_RESP"; exit 1; fi
fi

# =============================================================================
# PROJECT 1 — EPICS
# =============================================================================

echo ""
echo "  📌 Creating Epics for Project 1..."

# Epic 1: User Authentication & Security
EPIC1_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "title": "User Authentication & Security",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "epic",
    "priority": "high",
    "storyPoints": 21,
    "assigneeId": "'"$ADMIN_ID"'",
    "status": "in_progress",
    "description": "Comprehensive authentication and security module covering JWT, OAuth, MFA, and SAML integration.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
EPIC1_ID=$(extract_id "$EPIC1_RESP")
check_id "$EPIC1_ID" "Epic 1: User Authentication & Security"

# Epic 2: Dashboard & Analytics Module
EPIC2_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "title": "Dashboard & Analytics Module",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "epic",
    "priority": "high",
    "storyPoints": 34,
    "assigneeId": "'"$MANAGER_ID"'",
    "status": "in_progress",
    "description": "Real-time analytics dashboard with customizable widgets, charts, and data export capabilities.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
EPIC2_ID=$(extract_id "$EPIC2_RESP")
check_id "$EPIC2_ID" "Epic 2: Dashboard & Analytics Module"

# Epic 3: Mobile Responsive Design
EPIC3_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "title": "Mobile Responsive Design",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "epic",
    "priority": "medium",
    "storyPoints": 13,
    "assigneeId": "'"$DESIGNER_ID"'",
    "status": "todo",
    "description": "Full mobile responsiveness across all platform modules. Touch-friendly UI with adaptive layouts.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
EPIC3_ID=$(extract_id "$EPIC3_RESP")
check_id "$EPIC3_ID" "Epic 3: Mobile Responsive Design"

# =============================================================================
# PROJECT 1 — SPRINT 1 (completed)
# =============================================================================

echo ""
echo "  🏃 Creating Sprint 1 (completed)..."

SP1_RESP=$(curl -s -X POST "$API/sprints" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Sprint 1 - Foundation",
    "boardId": "'"$P1_BOARD_ID"'",
    "projectId": "'"$P1_ID"'",
    "goal": "Establish core authentication infrastructure and CI/CD pipeline",
    "startDate": "'"$SPRINT1_START"'",
    "endDate": "'"$SPRINT1_END"'"
  }')
SP1_ID=$(extract_id "$SP1_RESP")
check_id "$SP1_ID" "Sprint 1 - Foundation"
if [ -z "$SP1_ID" ]; then echo "  Response: $SP1_RESP"; exit 1; fi

# ── Sprint 1 Tasks ──
echo ""
echo "  📝 Creating Sprint 1 tasks..."

SP1_T1_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Set up JWT authentication flow",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "story",
    "priority": "high",
    "storyPoints": 8,
    "assigneeId": "'"$DEV_ID"'",
    "status": "done",
    "parentTaskId": "'"$EPIC1_ID"'",
    "description": "Implement JWT-based authentication with access and refresh token rotation. Include token blacklisting on logout.",
    "boardId": "'"$P1_BOARD_ID"'",
    "sprintId": "'"$SP1_ID"'"
  }')
SP1_T1_ID=$(extract_id "$SP1_T1_RESP")
check_id "$SP1_T1_ID" "Sprint1/Story: Set up JWT authentication flow"

SP1_T2_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DESIGNER_TOKEN" \
  -d '{
    "title": "Design login page mockups",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "task",
    "priority": "medium",
    "storyPoints": 3,
    "assigneeId": "'"$DESIGNER_ID"'",
    "status": "done",
    "parentTaskId": "'"$EPIC1_ID"'",
    "description": "Create Figma mockups for the login page including light/dark variants, error states, and mobile views.",
    "boardId": "'"$P1_BOARD_ID"'",
    "sprintId": "'"$SP1_ID"'"
  }')
SP1_T2_ID=$(extract_id "$SP1_T2_RESP")
check_id "$SP1_T2_ID" "Sprint1/Task: Design login page mockups"

SP1_T3_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Implement password hashing",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "task",
    "priority": "high",
    "storyPoints": 2,
    "assigneeId": "'"$DEV_ID"'",
    "status": "done",
    "parentTaskId": "'"$EPIC1_ID"'",
    "description": "Integrate bcrypt with configurable salt rounds. Ensure password history and strength validation.",
    "boardId": "'"$P1_BOARD_ID"'",
    "sprintId": "'"$SP1_ID"'"
  }')
SP1_T3_ID=$(extract_id "$SP1_T3_RESP")
check_id "$SP1_T3_ID" "Sprint1/Task: Implement password hashing"

SP1_T4_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Create user registration API",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "story",
    "priority": "high",
    "storyPoints": 5,
    "assigneeId": "'"$DEV_ID"'",
    "status": "done",
    "parentTaskId": "'"$EPIC1_ID"'",
    "description": "Build POST /auth/register endpoint with email verification, duplicate checks, and welcome email via Mailhog.",
    "boardId": "'"$P1_BOARD_ID"'",
    "sprintId": "'"$SP1_ID"'"
  }')
SP1_T4_ID=$(extract_id "$SP1_T4_RESP")
check_id "$SP1_T4_ID" "Sprint1/Story: Create user registration API"

SP1_T5_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Setup CI/CD pipeline",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "task",
    "priority": "medium",
    "storyPoints": 3,
    "assigneeId": "'"$DEV_ID"'",
    "status": "done",
    "description": "Configure GitHub Actions workflows for lint, test, build, and deploy stages across all services.",
    "boardId": "'"$P1_BOARD_ID"'",
    "sprintId": "'"$SP1_ID"'"
  }')
SP1_T5_ID=$(extract_id "$SP1_T5_RESP")
check_id "$SP1_T5_ID" "Sprint1/Task: Setup CI/CD pipeline"

SP1_T6_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Write authentication unit tests",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "task",
    "priority": "low",
    "storyPoints": 2,
    "assigneeId": "'"$DEV_ID"'",
    "status": "done",
    "parentTaskId": "'"$EPIC1_ID"'",
    "description": "Jest unit tests covering login, register, token refresh, and account lockout flows. Target 80% coverage.",
    "boardId": "'"$P1_BOARD_ID"'",
    "sprintId": "'"$SP1_ID"'"
  }')
SP1_T6_ID=$(extract_id "$SP1_T6_RESP")
check_id "$SP1_T6_ID" "Sprint1/Task: Write authentication unit tests"

# ── Add comments to Sprint 1 tasks ──
echo ""
echo "  💬 Adding comments to Sprint 1 tasks..."
if [ -n "$SP1_T1_ID" ]; then
  curl -s -X POST "$API/tasks/$SP1_T1_ID/comments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DEV_TOKEN" \
    -d '{"content":"Implemented RS256 signing for JWT. Access token expiry set to 15 min, refresh to 7 days. Token rotation working correctly."}' > /dev/null
  echo "    ✅ Comment added to: Set up JWT authentication flow"
  curl -s -X POST "$API/tasks/$SP1_T1_ID/comments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{"content":"Great work! Verified the refresh flow in staging. Ready to merge to main."}' > /dev/null
  echo "    ✅ Comment 2 added to: Set up JWT authentication flow"
fi
if [ -n "$SP1_T4_ID" ]; then
  curl -s -X POST "$API/tasks/$SP1_T4_ID/comments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DEV_TOKEN" \
    -d '{"content":"Registration endpoint live at /api/v1/auth/register. Added duplicate email check and sends welcome email via SMTP."}' > /dev/null
  echo "    ✅ Comment added to: Create user registration API"
fi

# ── Add tasks to Sprint 1, then start, then complete ──
echo ""
echo "  ⚡ Adding tasks to Sprint 1..."
SP1_TASK_IDS=""
for TID in "$SP1_T1_ID" "$SP1_T2_ID" "$SP1_T3_ID" "$SP1_T4_ID" "$SP1_T5_ID" "$SP1_T6_ID"; do
  if [ -n "$TID" ]; then
    SP1_TASK_IDS="${SP1_TASK_IDS}\"$TID\","
  fi
done
SP1_TASK_IDS="[${SP1_TASK_IDS%,}]"

ADD_SPRINT1_RESP=$(curl -s -X POST "$API/sprints/$SP1_ID/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"taskIds\": $SP1_TASK_IDS}")
echo "  ✅ Tasks added to Sprint 1"

echo "  🚀 Starting Sprint 1..."
curl -s -X POST "$API/sprints/$SP1_ID/start" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
echo "  ✅ Sprint 1 started"

echo "  🏁 Completing Sprint 1..."
COMPLETE_SP1=$(curl -s -X POST "$API/sprints/$SP1_ID/complete" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"moveUnfinishedTo":"backlog"}')
echo "  ✅ Sprint 1 completed"

# =============================================================================
# PROJECT 1 — SPRINT 2 (active)
# =============================================================================

echo ""
echo "  🏃 Creating Sprint 2 (active)..."

SP2_RESP=$(curl -s -X POST "$API/sprints" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Sprint 2 - Dashboard",
    "boardId": "'"$P1_BOARD_ID"'",
    "projectId": "'"$P1_ID"'",
    "goal": "Deliver core dashboard widgets and analytics data pipeline. Begin mobile responsiveness.",
    "startDate": "'"$SPRINT2_START"'",
    "endDate": "'"$SPRINT2_END"'"
  }')
SP2_ID=$(extract_id "$SP2_RESP")
check_id "$SP2_ID" "Sprint 2 - Dashboard"
if [ -z "$SP2_ID" ]; then echo "  Response: $SP2_RESP"; exit 1; fi

# ── Sprint 2 Tasks ──
echo ""
echo "  📝 Creating Sprint 2 tasks..."

SP2_T1_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Build dashboard overview widget",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "story",
    "priority": "high",
    "storyPoints": 8,
    "assigneeId": "'"$DEV_ID"'",
    "status": "in_progress",
    "parentTaskId": "'"$EPIC2_ID"'",
    "description": "Stat cards showing total employees, active projects, pending leaves, and attendance rate. Real-time data from APIs.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
SP2_T1_ID=$(extract_id "$SP2_T1_RESP")
check_id "$SP2_T1_ID" "Sprint2/Story: Build dashboard overview widget"

SP2_T2_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Create analytics data pipeline",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "task",
    "priority": "high",
    "storyPoints": 5,
    "assigneeId": "'"$DEV_ID"'",
    "status": "in_progress",
    "parentTaskId": "'"$EPIC2_ID"'",
    "description": "Aggregation pipeline using MongoDB aggregations. Cache results in Redis with 5-minute TTL.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
SP2_T2_ID=$(extract_id "$SP2_T2_RESP")
check_id "$SP2_T2_ID" "Sprint2/Task: Create analytics data pipeline"

SP2_T3_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DESIGNER_TOKEN" \
  -d '{
    "title": "Design dashboard UI components",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "story",
    "priority": "high",
    "storyPoints": 5,
    "assigneeId": "'"$DESIGNER_ID"'",
    "status": "in_review",
    "parentTaskId": "'"$EPIC2_ID"'",
    "description": "Figma designs for all dashboard cards, charts, and empty states. Handoff to dev with Tailwind tokens.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
SP2_T3_ID=$(extract_id "$SP2_T3_RESP")
check_id "$SP2_T3_ID" "Sprint2/Story: Design dashboard UI components"

SP2_T4_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Fix session timeout bug",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "bug",
    "priority": "critical",
    "storyPoints": 3,
    "assigneeId": "'"$DEV_ID"'",
    "status": "in_progress",
    "description": "Users are being logged out after 5 minutes despite activity. JWT refresh not triggering on idle state. Repro: open dashboard, wait 5 min.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
SP2_T4_ID=$(extract_id "$SP2_T4_RESP")
check_id "$SP2_T4_ID" "Sprint2/Bug: Fix session timeout bug"

SP2_T5_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Add chart export functionality",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "task",
    "priority": "medium",
    "storyPoints": 3,
    "assigneeId": "'"$DEV_ID"'",
    "status": "todo",
    "parentTaskId": "'"$EPIC2_ID"'",
    "description": "Export charts as PNG/PDF from the analytics dashboard. Use html2canvas or recharts export utilities.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
SP2_T5_ID=$(extract_id "$SP2_T5_RESP")
check_id "$SP2_T5_ID" "Sprint2/Task: Add chart export functionality"

SP2_T6_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DESIGNER_TOKEN" \
  -d '{
    "title": "Make header responsive",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "task",
    "priority": "medium",
    "storyPoints": 2,
    "assigneeId": "'"$DESIGNER_ID"'",
    "status": "todo",
    "parentTaskId": "'"$EPIC3_ID"'",
    "description": "Collapse navigation items into hamburger menu on screens < 768px. Ensure logo and avatar remain visible.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
SP2_T6_ID=$(extract_id "$SP2_T6_RESP")
check_id "$SP2_T6_ID" "Sprint2/Task: Make header responsive"

SP2_T7_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DESIGNER_TOKEN" \
  -d '{
    "title": "Implement dark mode toggle",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "story",
    "priority": "medium",
    "storyPoints": 5,
    "assigneeId": "'"$DESIGNER_ID"'",
    "status": "blocked",
    "parentTaskId": "'"$EPIC3_ID"'",
    "description": "System-wide dark mode using CSS variables and next-themes. Blocked on design tokens finalization from design system team.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
SP2_T7_ID=$(extract_id "$SP2_T7_RESP")
check_id "$SP2_T7_ID" "Sprint2/Story: Implement dark mode toggle"

SP2_T8_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Add notification bell",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "task",
    "priority": "low",
    "storyPoints": 2,
    "assigneeId": "'"$DEV_ID"'",
    "status": "todo",
    "description": "Notification bell icon in header with unread badge. Dropdown shows last 10 notifications with mark-as-read support.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
SP2_T8_ID=$(extract_id "$SP2_T8_RESP")
check_id "$SP2_T8_ID" "Sprint2/Task: Add notification bell"

# ── Add comments to Sprint 2 tasks ──
echo ""
echo "  💬 Adding comments to Sprint 2 tasks..."
if [ -n "$SP2_T4_ID" ]; then
  curl -s -X POST "$API/tasks/$SP2_T4_ID/comments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DEV_TOKEN" \
    -d '{"content":"Root cause identified: axios interceptor not catching 401 when tab is in background. Working on a visibility-aware refresh strategy."}' > /dev/null
  echo "    ✅ Comment added to: Fix session timeout bug"
  curl -s -X POST "$API/tasks/$SP2_T4_ID/comments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -d '{"content":"This is blocking 3 other stories in the sprint. Please prioritize. Estimated fix time?"}' > /dev/null
  echo "    ✅ Comment 2 added to: Fix session timeout bug"
fi
if [ -n "$SP2_T7_ID" ]; then
  curl -s -X POST "$API/tasks/$SP2_T7_ID/comments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DESIGNER_TOKEN" \
    -d '{"content":"Blocked on NXP-34 (design tokens PR). Once merged, dark mode implementation should take ~2 days."}' > /dev/null
  echo "    ✅ Comment added to: Implement dark mode toggle"
fi

# ── Add tasks to Sprint 2, then start ──
echo ""
echo "  ⚡ Adding tasks to Sprint 2..."
SP2_TASK_IDS=""
for TID in "$SP2_T1_ID" "$SP2_T2_ID" "$SP2_T3_ID" "$SP2_T4_ID" "$SP2_T5_ID" "$SP2_T6_ID" "$SP2_T7_ID" "$SP2_T8_ID"; do
  if [ -n "$TID" ]; then
    SP2_TASK_IDS="${SP2_TASK_IDS}\"$TID\","
  fi
done
SP2_TASK_IDS="[${SP2_TASK_IDS%,}]"

curl -s -X POST "$API/sprints/$SP2_ID/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"taskIds\": $SP2_TASK_IDS}" > /dev/null
echo "  ✅ Tasks added to Sprint 2"

echo "  🚀 Starting Sprint 2..."
curl -s -X POST "$API/sprints/$SP2_ID/start" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
echo "  ✅ Sprint 2 started (active)"

# =============================================================================
# PROJECT 1 — BACKLOG ITEMS (no sprint)
# =============================================================================

echo ""
echo "  📋 Creating Project 1 backlog items..."

BL1_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Google OAuth integration",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "story",
    "priority": "high",
    "storyPoints": 8,
    "assigneeId": "'"$DEV_ID"'",
    "status": "backlog",
    "parentTaskId": "'"$EPIC1_ID"'",
    "description": "Integrate Google OAuth 2.0 using Passport.js google-oauth20 strategy. Link accounts with existing email on first login.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
check_id "$(extract_id "$BL1_RESP")" "Backlog/Story: Google OAuth integration"

BL2_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Two-factor authentication",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "story",
    "priority": "high",
    "storyPoints": 13,
    "assigneeId": "'"$DEV_ID"'",
    "status": "backlog",
    "parentTaskId": "'"$EPIC1_ID"'",
    "description": "TOTP-based MFA using speakeasy. QR code enrollment via authenticator app. Backup codes generation and storage.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
check_id "$(extract_id "$BL2_RESP")" "Backlog/Story: Two-factor authentication"

BL3_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Audit log viewer",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "task",
    "priority": "medium",
    "storyPoints": 5,
    "assigneeId": "'"$DEV_ID"'",
    "status": "backlog",
    "parentTaskId": "'"$EPIC1_ID"'",
    "description": "Admin page showing all security events: logins, logouts, failed attempts, role changes, and data exports.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
check_id "$(extract_id "$BL3_RESP")" "Backlog/Task: Audit log viewer"

BL4_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Performance optimization sprint",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "spike",
    "priority": "low",
    "storyPoints": 3,
    "assigneeId": "'"$DEV_ID"'",
    "status": "backlog",
    "description": "Research and POC: evaluate bundle splitting, lazy loading, and DB query optimization strategies for 500ms p99 target.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
check_id "$(extract_id "$BL4_RESP")" "Backlog/Spike: Performance optimization sprint"

BL5_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DESIGNER_TOKEN" \
  -d '{
    "title": "Mobile navigation component",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "task",
    "priority": "medium",
    "storyPoints": 5,
    "assigneeId": "'"$DESIGNER_ID"'",
    "status": "backlog",
    "parentTaskId": "'"$EPIC3_ID"'",
    "description": "Bottom tab bar navigation for mobile screens. Swipe gestures between main sections. Accessible with ARIA labels.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
check_id "$(extract_id "$BL5_RESP")" "Backlog/Task: Mobile navigation component"

BL6_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DESIGNER_TOKEN" \
  -d '{
    "title": "Touch gesture support",
    "projectId": "'"$P1_ID"'",
    "projectKey": "NXP",
    "type": "task",
    "priority": "low",
    "storyPoints": 3,
    "assigneeId": "'"$DESIGNER_ID"'",
    "status": "backlog",
    "parentTaskId": "'"$EPIC3_ID"'",
    "description": "Swipe-to-dismiss notifications, pinch-to-zoom on charts, and pull-to-refresh on list views.",
    "boardId": "'"$P1_BOARD_ID"'"
  }')
check_id "$(extract_id "$BL6_RESP")" "Backlog/Task: Touch gesture support"

echo ""
echo "  ✅ Project 1 complete!"

# =============================================================================
# ██████████████████████████████████████████████████████████████████████████
# PROJECT 2: "Customer Portal Redesign" — Kanban methodology
# ██████████████████████████████████████████████████████████████████████████
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 PROJECT 2: Customer Portal Redesign (Kanban)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

P2_RESP=$(curl -s -X POST "$API/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d '{
    "projectName": "Customer Portal Redesign",
    "description": "Complete UX overhaul of the customer-facing portal. Modernise the UI, improve performance, and add self-service features.",
    "methodology": "kanban",
    "priority": "high",
    "status": "active",
    "startDate": "'"$SPRINT2_START"'",
    "endDate": "'"$NEXT_MONTH"'",
    "tags": ["portal", "ux", "customer-facing"],
    "settings": {
      "boardType": "kanban",
      "estimationUnit": "story_points",
      "enableTimeTracking": true,
      "enableSubtasks": true,
      "enableEpics": false,
      "enableSprints": false
    }
  }')
P2_ID=$(extract_id "$P2_RESP")
check_id "$P2_ID" "Project 2: Customer Portal Redesign"
if [ -z "$P2_ID" ]; then echo "  Response: $P2_RESP"; exit 1; fi

# ── Add team members to Project 2 ──
echo ""
echo "  👥 Adding team members to Project 2..."
curl -s -X POST "$API/projects/$P2_ID/team" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d '{"userId":"'"$DEV_ID"'","role":"member","projectRole":"Full-Stack Developer"}' > /dev/null
echo "    ✅ Dev added"
curl -s -X POST "$API/projects/$P2_ID/team" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d '{"userId":"'"$DESIGNER_ID"'","role":"member","projectRole":"UI/UX Designer"}' > /dev/null
echo "    ✅ Designer added"

# ── Create Kanban Board for Project 2 ──
echo ""
echo "  🗂️  Creating Kanban board..."
P2_BOARD_RESP=$(curl -s -X POST "$API/boards/from-template" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d '{
    "projectId": "'"$P2_ID"'",
    "type": "kanban"
  }')
P2_BOARD_ID=$(extract_id "$P2_BOARD_RESP")
check_id "$P2_BOARD_ID" "Kanban Board for Project 2"
if [ -z "$P2_BOARD_ID" ]; then
  echo "  Response: $P2_BOARD_RESP"
  # Fallback: manual board creation
  P2_BOARD_RESP=$(curl -s -X POST "$API/boards" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -d '{
      "name": "Customer Portal Kanban",
      "projectId": "'"$P2_ID"'",
      "type": "kanban",
      "columns": [
        {"name":"Inbox","order":0,"key":"backlog","statusMapping":["backlog"],"isStartColumn":true},
        {"name":"Ready","order":1,"key":"todo","statusMapping":["todo"]},
        {"name":"In Progress","order":2,"key":"in_progress","statusMapping":["in_progress"]},
        {"name":"Review","order":3,"key":"in_review","statusMapping":["in_review"]},
        {"name":"Done","order":4,"key":"done","statusMapping":["done"],"isDoneColumn":true}
      ]
    }')
  P2_BOARD_ID=$(extract_id "$P2_BOARD_RESP")
  check_id "$P2_BOARD_ID" "Kanban Board for Project 2 (manual)"
  if [ -z "$P2_BOARD_ID" ]; then echo "  Board fallback response: $P2_BOARD_RESP"; exit 1; fi
fi

# ── Project 2 Tasks (Kanban — no sprints) ──
echo ""
echo "  📝 Creating Project 2 tasks..."

P2_T1_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Customer feedback form",
    "projectId": "'"$P2_ID"'",
    "projectKey": "CPR",
    "type": "task",
    "priority": "high",
    "storyPoints": 3,
    "assigneeId": "'"$DEV_ID"'",
    "status": "done",
    "description": "Multi-step feedback form with NPS score, category selector, and free-text. Submitted data stored in CRM.",
    "boardId": "'"$P2_BOARD_ID"'"
  }')
check_id "$(extract_id "$P2_T1_RESP")" "P2/Task: Customer feedback form"

P2_T2_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Portal authentication flow",
    "projectId": "'"$P2_ID"'",
    "projectKey": "CPR",
    "type": "story",
    "priority": "high",
    "storyPoints": 5,
    "assigneeId": "'"$DEV_ID"'",
    "status": "done",
    "description": "Separate auth context for customer portal. Magic link login + social login (Google). No password required.",
    "boardId": "'"$P2_BOARD_ID"'"
  }')
check_id "$(extract_id "$P2_T2_RESP")" "P2/Story: Portal authentication flow"

P2_T3_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DESIGNER_TOKEN" \
  -d '{
    "title": "Redesign customer dashboard",
    "projectId": "'"$P2_ID"'",
    "projectKey": "CPR",
    "type": "story",
    "priority": "high",
    "storyPoints": 8,
    "assigneeId": "'"$DESIGNER_ID"'",
    "status": "in_progress",
    "description": "Complete visual redesign of the customer home screen. Card-based layout, activity feed, quick actions, and account health score.",
    "boardId": "'"$P2_BOARD_ID"'"
  }')
P2_T3_ID=$(extract_id "$P2_T3_RESP")
check_id "$P2_T3_ID" "P2/Story: Redesign customer dashboard"

P2_T4_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Add invoice download feature",
    "projectId": "'"$P2_ID"'",
    "projectKey": "CPR",
    "type": "task",
    "priority": "medium",
    "storyPoints": 3,
    "assigneeId": "'"$DEV_ID"'",
    "status": "in_progress",
    "description": "Allow customers to download PDF invoices from the portal. Generate PDFs on-demand using Puppeteer.",
    "boardId": "'"$P2_BOARD_ID"'"
  }')
check_id "$(extract_id "$P2_T4_RESP")" "P2/Task: Add invoice download feature"

P2_T5_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Fix portal login bug",
    "projectId": "'"$P2_ID"'",
    "projectKey": "CPR",
    "type": "bug",
    "priority": "critical",
    "storyPoints": 2,
    "assigneeId": "'"$DEV_ID"'",
    "status": "in_review",
    "description": "Magic link emails not delivered to Outlook addresses. SPF/DKIM records missing causing spam filter blocks. Repro: register with @outlook.com email.",
    "boardId": "'"$P2_BOARD_ID"'"
  }')
P2_T5_ID=$(extract_id "$P2_T5_RESP")
check_id "$P2_T5_ID" "P2/Bug: Fix portal login bug"

P2_T6_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Add customer support chat",
    "projectId": "'"$P2_ID"'",
    "projectKey": "CPR",
    "type": "task",
    "priority": "medium",
    "storyPoints": 5,
    "assigneeId": "'"$DEV_ID"'",
    "status": "backlog",
    "description": "Integrate Intercom or build custom chat widget. Support agents can see customer context (account tier, recent activity).",
    "boardId": "'"$P2_BOARD_ID"'"
  }')
check_id "$(extract_id "$P2_T6_RESP")" "P2/Task: Add customer support chat"

P2_T7_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Multi-language support",
    "projectId": "'"$P2_ID"'",
    "projectKey": "CPR",
    "type": "story",
    "priority": "low",
    "storyPoints": 13,
    "assigneeId": "'"$DEV_ID"'",
    "status": "backlog",
    "description": "i18n via next-intl. Initial languages: English, French, German, Spanish. Translation keys managed in Lokalise.",
    "boardId": "'"$P2_BOARD_ID"'"
  }')
check_id "$(extract_id "$P2_T7_RESP")" "P2/Story: Multi-language support"

P2_T8_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Performance test portal load",
    "projectId": "'"$P2_ID"'",
    "projectKey": "CPR",
    "type": "task",
    "priority": "medium",
    "storyPoints": 2,
    "assigneeId": "'"$DEV_ID"'",
    "status": "backlog",
    "description": "k6 load tests targeting 1000 concurrent users. Identify bottlenecks before launch. Target: < 2s TTI on 3G.",
    "boardId": "'"$P2_BOARD_ID"'"
  }')
check_id "$(extract_id "$P2_T8_RESP")" "P2/Task: Performance test portal load"

# ── Comments on Project 2 tasks ──
echo ""
echo "  💬 Adding comments to Project 2 tasks..."
if [ -n "$P2_T5_ID" ]; then
  curl -s -X POST "$API/tasks/$P2_T5_ID/comments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DEV_TOKEN" \
    -d '{"content":"Added SPF record and configured DKIM via Route53. Awaiting DNS propagation (up to 48h). Will retest with Outlook after propagation."}' > /dev/null
  echo "    ✅ Comment added to: Fix portal login bug"
  curl -s -X POST "$API/tasks/$P2_T5_ID/comments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -d '{"content":"Customer reported this morning that 3 accounts cannot log in. This is now P0. Please update when DNS is confirmed."}' > /dev/null
  echo "    ✅ Comment 2 added to: Fix portal login bug"
fi
if [ -n "$P2_T3_ID" ]; then
  curl -s -X POST "$API/tasks/$P2_T3_ID/comments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DESIGNER_TOKEN" \
    -d '{"content":"Figma prototype ready for review: figma.com/proto/NXP-portal-redesign. Please leave comments directly in Figma."}' > /dev/null
  echo "    ✅ Comment added to: Redesign customer dashboard"
fi

echo ""
echo "  ✅ Project 2 complete!"

# =============================================================================
# ██████████████████████████████████████████████████████████████████████████
# PROJECT 3: "DevOps Infrastructure Overhaul" — Waterfall methodology
# ██████████████████████████████████████████████████████████████████████████
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 PROJECT 3: DevOps Infrastructure Overhaul (Waterfall)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

P3_RESP=$(curl -s -X POST "$API/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d '{
    "projectName": "DevOps Infrastructure Overhaul",
    "description": "Full migration from bare-metal servers to Kubernetes. Implement GitOps, observability stack, and automated DR.",
    "methodology": "waterfall",
    "priority": "high",
    "status": "active",
    "startDate": "'"$SPRINT1_START"'",
    "endDate": "'"$NEXT_MONTH"'",
    "tags": ["devops", "kubernetes", "infrastructure", "k8s"],
    "settings": {
      "boardType": "custom",
      "estimationUnit": "story_points",
      "enableTimeTracking": true,
      "enableSubtasks": true,
      "enableEpics": false,
      "enableSprints": false
    }
  }')
P3_ID=$(extract_id "$P3_RESP")
check_id "$P3_ID" "Project 3: DevOps Infrastructure Overhaul"
if [ -z "$P3_ID" ]; then echo "  Response: $P3_RESP"; exit 1; fi

# ── Add team members to Project 3 ──
echo ""
echo "  👥 Adding team members to Project 3..."
curl -s -X POST "$API/projects/$P3_ID/team" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d '{"userId":"'"$DEV_ID"'","role":"member","projectRole":"DevOps Engineer"}' > /dev/null
echo "    ✅ Dev added"

# ── Create Custom Board for Project 3 (Waterfall phases) ──
echo ""
echo "  🗂️  Creating custom board (Waterfall phases)..."
P3_BOARD_RESP=$(curl -s -X POST "$API/boards" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d '{
    "name": "DevOps Overhaul — Waterfall",
    "projectId": "'"$P3_ID"'",
    "type": "custom",
    "description": "Phase-gated waterfall board for infrastructure migration",
    "columns": [
      {"name":"Requirements","order":0,"key":"backlog","statusMapping":["backlog"],"isStartColumn":true},
      {"name":"Design","order":1,"key":"todo","statusMapping":["todo"]},
      {"name":"Development","order":2,"key":"in_progress","statusMapping":["in_progress"]},
      {"name":"Testing","order":3,"key":"in_review","statusMapping":["in_review"]},
      {"name":"Deployed","order":4,"key":"done","statusMapping":["done"],"isDoneColumn":true}
    ]
  }')
P3_BOARD_ID=$(extract_id "$P3_BOARD_RESP")
check_id "$P3_BOARD_ID" "Custom Board for Project 3 (Waterfall)"
if [ -z "$P3_BOARD_ID" ]; then
  echo "  Response: $P3_BOARD_RESP"
  # Fallback: from-template custom
  P3_BOARD_RESP=$(curl -s -X POST "$API/boards/from-template" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -d '{
      "projectId": "'"$P3_ID"'",
      "type": "custom"
    }')
  P3_BOARD_ID=$(extract_id "$P3_BOARD_RESP")
  check_id "$P3_BOARD_ID" "Custom Board for Project 3 (fallback template)"
  if [ -z "$P3_BOARD_ID" ]; then echo "  Board fallback response: $P3_BOARD_RESP"; exit 1; fi
fi

# ── Project 3 Tasks ──
echo ""
echo "  📝 Creating Project 3 tasks..."

P3_T1_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d '{
    "title": "Document infrastructure requirements",
    "projectId": "'"$P3_ID"'",
    "projectKey": "DOI",
    "type": "task",
    "priority": "high",
    "storyPoints": 5,
    "assigneeId": "'"$MANAGER_ID"'",
    "status": "done",
    "description": "RFC document covering compute, storage, network, security, and compliance requirements. Review with CTO and SRE lead.",
    "boardId": "'"$P3_BOARD_ID"'"
  }')
P3_T1_ID=$(extract_id "$P3_T1_RESP")
check_id "$P3_T1_ID" "P3/Task: Document infrastructure requirements"

P3_T2_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Design Kubernetes architecture",
    "projectId": "'"$P3_ID"'",
    "projectKey": "DOI",
    "type": "task",
    "priority": "high",
    "storyPoints": 8,
    "assigneeId": "'"$DEV_ID"'",
    "status": "done",
    "description": "Multi-region K8s cluster design. Namespaces per environment, network policies, RBAC, and HPA configuration.",
    "boardId": "'"$P3_BOARD_ID"'"
  }')
P3_T2_ID=$(extract_id "$P3_T2_RESP")
check_id "$P3_T2_ID" "P3/Task: Design Kubernetes architecture"

P3_T3_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Set up monitoring stack",
    "projectId": "'"$P3_ID"'",
    "projectKey": "DOI",
    "type": "task",
    "priority": "high",
    "storyPoints": 5,
    "assigneeId": "'"$DEV_ID"'",
    "status": "in_progress",
    "description": "Deploy Prometheus + Grafana + Alertmanager. Configure dashboards for service health, latency, and error rates. PagerDuty integration.",
    "boardId": "'"$P3_BOARD_ID"'"
  }')
P3_T3_ID=$(extract_id "$P3_T3_RESP")
check_id "$P3_T3_ID" "P3/Task: Set up monitoring stack"

P3_T4_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Configure CI/CD pipelines",
    "projectId": "'"$P3_ID"'",
    "projectKey": "DOI",
    "type": "task",
    "priority": "high",
    "storyPoints": 8,
    "assigneeId": "'"$DEV_ID"'",
    "status": "in_progress",
    "description": "ArgoCD GitOps setup. Helm charts for all 14 services. Rolling update strategy with auto-rollback on failed health checks.",
    "boardId": "'"$P3_BOARD_ID"'"
  }')
check_id "$(extract_id "$P3_T4_RESP")" "P3/Task: Configure CI/CD pipelines"

P3_T5_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Load testing",
    "projectId": "'"$P3_ID"'",
    "projectKey": "DOI",
    "type": "task",
    "priority": "medium",
    "storyPoints": 3,
    "assigneeId": "'"$DEV_ID"'",
    "status": "todo",
    "description": "k6 scripts for all critical API paths. Baseline: 500 RPS. Spike test to 5000 RPS. Chaos engineering with Chaos Monkey.",
    "boardId": "'"$P3_BOARD_ID"'"
  }')
check_id "$(extract_id "$P3_T5_RESP")" "P3/Task: Load testing"

P3_T6_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "title": "Security hardening",
    "projectId": "'"$P3_ID"'",
    "projectKey": "DOI",
    "type": "task",
    "priority": "critical",
    "storyPoints": 5,
    "assigneeId": "'"$DEV_ID"'",
    "status": "todo",
    "description": "Pod security standards (restricted), network policies deny-all-by-default, secrets management via Vault, image scanning with Trivy.",
    "boardId": "'"$P3_BOARD_ID"'"
  }')
check_id "$(extract_id "$P3_T6_RESP")" "P3/Task: Security hardening"

P3_T7_RESP=$(curl -s -X POST "$API/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d '{
    "title": "DR and backup strategy",
    "projectId": "'"$P3_ID"'",
    "projectKey": "DOI",
    "type": "task",
    "priority": "high",
    "storyPoints": 3,
    "assigneeId": "'"$MANAGER_ID"'",
    "status": "backlog",
    "description": "Define RTO/RPO targets. Velero for K8s backups. MongoDB Atlas cross-region replication. Documented runbook and quarterly DR drills.",
    "boardId": "'"$P3_BOARD_ID"'"
  }')
check_id "$(extract_id "$P3_T7_RESP")" "P3/Task: DR and backup strategy"

# ── Comments on Project 3 tasks ──
echo ""
echo "  💬 Adding comments to Project 3 tasks..."
if [ -n "$P3_T3_ID" ]; then
  curl -s -X POST "$API/tasks/$P3_T3_ID/comments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DEV_TOKEN" \
    -d '{"content":"Prometheus and Grafana deployed in monitoring namespace. 12 dashboards imported from grafana.com. Still need to configure Alertmanager receivers."}' > /dev/null
  echo "    ✅ Comment added to: Set up monitoring stack"
  curl -s -X POST "$API/tasks/$P3_T3_ID/comments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -d '{"content":"Do we have an alert for disk pressure? Last incident we missed disk filling up on node-2. Please add that before marking done."}' > /dev/null
  echo "    ✅ Comment 2 added to: Set up monitoring stack"
fi
if [ -n "$P3_T2_ID" ]; then
  curl -s -X POST "$API/tasks/$P3_T2_ID/comments" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DEV_TOKEN" \
    -d '{"content":"Architecture doc reviewed and approved by CTO. Going with EKS on us-east-1 (primary) and eu-west-1 (failover). Terraform modules in progress."}' > /dev/null
  echo "    ✅ Comment added to: Design Kubernetes architecture"
fi

echo ""
echo "  ✅ Project 3 complete!"

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Seed complete! Data has been created."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Summary:"
echo "   Project 1 ID : $P1_ID"
echo "   Board 1 ID   : $P1_BOARD_ID"
echo "   Sprint 1 ID  : $SP1_ID  (completed ✓)"
echo "   Sprint 2 ID  : $SP2_ID  (active ✓)"
echo ""
echo "   Project 2 ID : $P2_ID"
echo "   Board 2 ID   : $P2_BOARD_ID"
echo ""
echo "   Project 3 ID : $P3_ID"
echo "   Board 3 ID   : $P3_BOARD_ID"
echo ""
echo "🔗 URLs:"
echo "   Frontend    : http://localhost:3100"
echo "   API Gateway : http://localhost:3005"
echo "   MailHog     : http://localhost:8025"
echo ""
echo "🧑 Test Users:"
echo "   admin@nexora.io    / Admin@123456"
echo "   dev@nexora.io      / Dev@123456"
echo "   designer@nexora.io / Design@123456"
echo "   manager@nexora.io  / Manager@123456"
echo ""
