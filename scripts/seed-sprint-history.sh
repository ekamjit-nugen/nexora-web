#!/bin/bash
# seed-sprint-history.sh — DEV_ONLY
# Adds 3 completed sprints with varying velocity so all report charts are populated.
# Run AFTER seed-jira-data.sh (which leaves Sprint 2 active).
# Usage: bash scripts/seed-sprint-history.sh

set -e
API="http://localhost:3005/api/v1"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ Sprint History Seeder"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Auth (OTP flow; dev OTP = 000000) ──
EMAIL="varun@gmail.com"
echo "Logging in as $EMAIL..."
curl -s -X POST "$API/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}" > /dev/null
VERIFY=$(curl -s -X POST "$API/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"otp\":\"000000\"}")
TOKEN=$(echo "$VERIFY" | grep -o '"accessToken":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Run seed-jira-data.sh first to create the user."
  exit 1
fi
echo "  ✅ Logged in"

extract_id() { echo "$1" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4; }

# ── Get first project ──
PROJECTS=$(curl -s "$API/projects" -H "Authorization: Bearer $TOKEN")
P_ID=$(extract_id "$PROJECTS")
if [ -z "$P_ID" ]; then
  echo "❌ No projects found. Run seed-jira-data.sh first."
  exit 1
fi
echo "  ✅ Project: $P_ID"

# ── Get first board ──
BOARDS=$(curl -s "$API/boards?projectId=$P_ID" -H "Authorization: Bearer $TOKEN" 2>/dev/null || \
         curl -s "$API/projects/$P_ID/boards" -H "Authorization: Bearer $TOKEN" 2>/dev/null || echo '{}')
B_ID=$(extract_id "$BOARDS")
if [ -z "$B_ID" ]; then
  echo "❌ No board found."
  exit 1
fi
echo "  ✅ Board: $B_ID"

# ── Complete currently active sprint (Sprint 2) ──
echo ""
echo "Completing active Sprint 2 (carry unfinished → backlog)..."
ACTIVE=$(curl -s "$API/sprints/board/$B_ID/active" -H "Authorization: Bearer $TOKEN")
ACTIVE_ID=$(extract_id "$ACTIVE")
if [ -n "$ACTIVE_ID" ]; then
  curl -s -X POST "$API/sprints/$ACTIVE_ID/complete" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"moveUnfinishedTo":"backlog"}' > /dev/null
  echo "  ✅ Sprint 2 completed (id: $ACTIVE_ID)"
else
  echo "  ⚠️  No active sprint found (Sprint 2 may already be completed)"
fi

# ── Helper: create + populate + start + complete a sprint ──
seed_sprint() {
  local NAME="$1"; local GOAL="$2"; local START="$3"; local END="$4"
  local DONE_PTS="$5"   # story points for "done" tasks
  local TODO_PTS="$6"   # story points for "todo" tasks (will spill)
  local CARRY="$7"      # "backlog" or "next_sprint"

  echo ""
  echo "Creating '$NAME'..."
  SP_RESP=$(curl -s -X POST "$API/sprints" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$NAME\",\"goal\":\"$GOAL\",\"boardId\":\"$B_ID\",\"projectId\":\"$P_ID\",\"startDate\":\"$START\",\"endDate\":\"$END\"}")
  SP_ID=$(extract_id "$SP_RESP")
  if [ -z "$SP_ID" ]; then echo "  ❌ Failed to create sprint"; return 1; fi
  echo "  ✅ Sprint id: $SP_ID"

  # Create "done" tasks
  TASK_IDS=""
  local pts=$DONE_PTS
  local i=1
  while [ $pts -gt 0 ]; do
    local p=5; [ $pts -lt 5 ] && p=$pts
    T=$(curl -s -X POST "$API/tasks" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"title\":\"$NAME — story $i\",\"projectId\":\"$P_ID\",\"status\":\"done\",\"priority\":\"medium\",\"type\":\"story\",\"storyPoints\":$p}" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$T" ]; then TASK_IDS="$TASK_IDS\"$T\","; fi
    pts=$((pts - p)); i=$((i + 1))
  done

  # Create "todo" tasks (incomplete → will spill)
  pts=$TODO_PTS; j=1
  while [ $pts -gt 0 ]; do
    local p=3; [ $pts -lt 3 ] && p=$pts
    T=$(curl -s -X POST "$API/tasks" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"title\":\"$NAME — incomplete $j\",\"projectId\":\"$P_ID\",\"status\":\"todo\",\"priority\":\"low\",\"type\":\"task\",\"storyPoints\":$p}" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$T" ]; then TASK_IDS="$TASK_IDS\"$T\","; fi
    pts=$((pts - p)); j=$((j + 1))
  done

  TASK_IDS="[${TASK_IDS%,}]"

  # Add tasks to sprint
  curl -s -X POST "$API/sprints/$SP_ID/tasks" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"taskIds\": $TASK_IDS}" > /dev/null
  echo "  ✅ Tasks added"

  # Start
  curl -s -X POST "$API/sprints/$SP_ID/start" \
    -H "Authorization: Bearer $TOKEN" > /dev/null
  echo "  ✅ Sprint started"

  # Complete
  curl -s -X POST "$API/sprints/$SP_ID/complete" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"moveUnfinishedTo\":\"$CARRY\"}" > /dev/null
  echo "  ✅ Sprint completed (carry → $CARRY)"

  echo "$SP_ID"
}

# Sprint 3 — high velocity (30 pts done, 5 spill → backlog)
SP3_ID=$(seed_sprint \
  "Sprint 3 - Core Features" \
  "Task board, drag-and-drop, sprint views" \
  "2026-02-02" "2026-02-15" \
  30 5 "backlog")

# Sprint 4 — medium velocity (20 pts done, 10 spill → next sprint)
SP4_ID=$(seed_sprint \
  "Sprint 4 - Integrations" \
  "OAuth, SAML, Slack connector" \
  "2026-02-16" "2026-03-01" \
  20 10 "next_sprint")

# Sprint 5 — lower velocity (15 pts done, 12 spill → backlog)
SP5_ID=$(seed_sprint \
  "Sprint 5 - Polish" \
  "Dark mode, responsive layouts, bug fixes" \
  "2026-03-02" "2026-03-15" \
  15 12 "backlog")

# Sprint 6 — active (current sprint)
echo ""
echo "Creating Sprint 6 (active)..."
SP6_RESP=$(curl -s -X POST "$API/sprints" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Sprint 6 - Performance\",\"goal\":\"Redis caching, query optimisation, load testing\",\"boardId\":\"$B_ID\",\"projectId\":\"$P_ID\",\"startDate\":\"2026-03-16\",\"endDate\":\"2026-03-29\"}")
SP6_ID=$(extract_id "$SP6_RESP")

if [ -n "$SP6_ID" ]; then
  # Add a few in-progress tasks
  for TITLE in "Redis caching layer" "MongoDB query indexes" "Bundle size audit" "k6 load tests"; do
    T=$(curl -s -X POST "$API/tasks" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"title\":\"$TITLE\",\"projectId\":\"$P_ID\",\"status\":\"in_progress\",\"priority\":\"high\",\"type\":\"story\",\"storyPoints\":5}" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$T" ]; then
      curl -s -X POST "$API/sprints/$SP6_ID/tasks" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"taskIds\": [\"$T\"]}" > /dev/null
    fi
  done
  curl -s -X POST "$API/sprints/$SP6_ID/start" \
    -H "Authorization: Bearer $TOKEN" > /dev/null
  echo "  ✅ Sprint 6 started (active) — id: $SP6_ID"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Sprint history seeded!"
echo ""
echo "  Velocity history:"
echo "    Sprint 1: ~26 pts (from seed-jira-data.sh)"
echo "    Sprint 2: completed (carried → backlog)"
echo "    Sprint 3: 30 pts done, 5 spill → backlog"
echo "    Sprint 4: 20 pts done, 10 spill → next sprint (carry-over)"
echo "    Sprint 5: 15 pts done, 12 spill → backlog"
echo "    Sprint 6: active (current)"
echo ""
echo "  Open the Reports tab in any project to see all charts."
