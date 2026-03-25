#!/bin/bash
# DEV_ONLY: Remove before production
# Seed default roles via the auth API
# Usage: ./scripts/seed-roles.sh

API_URL="${API_URL:-http://localhost:3010/api/v1}"

echo "Seeding roles to $API_URL/auth/roles ..."

# Login to get token
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nexora.io","password":"Admin@123456"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Could not authenticate. Make sure admin@nexora.io exists."
  exit 1
fi

echo "Authenticated successfully."

create_role() {
  local data="$1"
  local name=$(echo "$data" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/roles" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$data")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -1)

  if [ "$HTTP_CODE" = "201" ]; then
    echo "  Created: $name"
  elif [ "$HTTP_CODE" = "409" ]; then
    echo "  Exists:  $name (skipped)"
  else
    echo "  FAILED:  $name (HTTP $HTTP_CODE) — $BODY"
  fi
}

# super_admin — ONLY system role, cannot be deleted
create_role '{
  "name": "super_admin",
  "displayName": "Super Administrator",
  "description": "Full unrestricted access to everything including system settings",
  "color": "#7C3AED",
  "isSystem": true,
  "permissions": [
    {"resource": "dashboard", "actions": ["view"]},
    {"resource": "employees", "actions": ["view","create","edit","delete","export","assign"]},
    {"resource": "attendance", "actions": ["view","create","edit","delete","export"]},
    {"resource": "leaves", "actions": ["view","create","edit","delete","export","assign"]},
    {"resource": "projects", "actions": ["view","create","edit","delete","export","assign"]},
    {"resource": "tasks", "actions": ["view","create","edit","delete","export","assign"]},
    {"resource": "departments", "actions": ["view","create","edit","delete"]},
    {"resource": "roles", "actions": ["view","create","edit","delete"]},
    {"resource": "policies", "actions": ["view","create","edit","delete"]},
    {"resource": "reports", "actions": ["view","export"]},
    {"resource": "invoices", "actions": ["view","create","edit","delete","export"]},
    {"resource": "expenses", "actions": ["view","create","edit","delete","export"]},
    {"resource": "clients", "actions": ["view","create","edit","delete"]},
    {"resource": "settings", "actions": ["view","edit"]}
  ]
}'

# admin — customizable, all permissions
create_role '{
  "name": "admin",
  "displayName": "Administrator",
  "description": "Full access to all modules, can be customized",
  "color": "#4F46E5",
  "isSystem": false,
  "permissions": [
    {"resource": "dashboard", "actions": ["view"]},
    {"resource": "employees", "actions": ["view","create","edit","delete","export","assign"]},
    {"resource": "attendance", "actions": ["view","create","edit","delete","export"]},
    {"resource": "leaves", "actions": ["view","create","edit","delete","export","assign"]},
    {"resource": "projects", "actions": ["view","create","edit","delete","export","assign"]},
    {"resource": "tasks", "actions": ["view","create","edit","delete","export","assign"]},
    {"resource": "departments", "actions": ["view","create","edit","delete"]},
    {"resource": "roles", "actions": ["view","create","edit","delete"]},
    {"resource": "policies", "actions": ["view","create","edit","delete"]},
    {"resource": "reports", "actions": ["view","export"]},
    {"resource": "invoices", "actions": ["view","create","edit","delete","export"]},
    {"resource": "expenses", "actions": ["view","create","edit","delete","export"]},
    {"resource": "clients", "actions": ["view","create","edit","delete"]},
    {"resource": "settings", "actions": ["view","edit"]}
  ]
}'

# hr
create_role '{
  "name": "hr",
  "displayName": "Human Resources",
  "description": "Full access to employees, attendance, leaves, policies, departments. View access to projects/tasks.",
  "color": "#0D9488",
  "isSystem": false,
  "permissions": [
    {"resource": "dashboard", "actions": ["view"]},
    {"resource": "employees", "actions": ["view","create","edit","delete","export","assign"]},
    {"resource": "attendance", "actions": ["view","create","edit","delete","export"]},
    {"resource": "leaves", "actions": ["view","create","edit","delete","export","assign"]},
    {"resource": "departments", "actions": ["view","create","edit","delete"]},
    {"resource": "policies", "actions": ["view","create","edit","delete"]},
    {"resource": "roles", "actions": ["view"]},
    {"resource": "projects", "actions": ["view"]},
    {"resource": "tasks", "actions": ["view"]},
    {"resource": "reports", "actions": ["view","export"]}
  ]
}'

# manager
create_role '{
  "name": "manager",
  "displayName": "Manager",
  "description": "Full access to projects/tasks. View employees, attendance, leaves with assign capability.",
  "color": "#D97706",
  "isSystem": false,
  "permissions": [
    {"resource": "dashboard", "actions": ["view"]},
    {"resource": "projects", "actions": ["view","create","edit","delete","export","assign"]},
    {"resource": "tasks", "actions": ["view","create","edit","delete","export","assign"]},
    {"resource": "employees", "actions": ["view","assign"]},
    {"resource": "attendance", "actions": ["view"]},
    {"resource": "leaves", "actions": ["view","assign"]},
    {"resource": "departments", "actions": ["view"]},
    {"resource": "reports", "actions": ["view","export"]}
  ]
}'

# employee
create_role '{
  "name": "employee",
  "displayName": "Employee",
  "description": "Own attendance/leaves/tasks access, view projects",
  "color": "#475569",
  "isSystem": false,
  "permissions": [
    {"resource": "dashboard", "actions": ["view"]},
    {"resource": "attendance", "actions": ["view","create"]},
    {"resource": "leaves", "actions": ["view","create"]},
    {"resource": "tasks", "actions": ["view"]},
    {"resource": "projects", "actions": ["view"]},
    {"resource": "employees", "actions": ["view"]},
    {"resource": "departments", "actions": ["view"]}
  ]
}'

# developer
create_role '{
  "name": "developer",
  "displayName": "Developer",
  "description": "Employee permissions plus full task management and export",
  "color": "#2563EB",
  "isSystem": false,
  "permissions": [
    {"resource": "dashboard", "actions": ["view"]},
    {"resource": "tasks", "actions": ["view","create","edit","export"]},
    {"resource": "projects", "actions": ["view"]},
    {"resource": "attendance", "actions": ["view","create"]},
    {"resource": "leaves", "actions": ["view","create"]},
    {"resource": "employees", "actions": ["view"]},
    {"resource": "departments", "actions": ["view"]}
  ]
}'

# designer
create_role '{
  "name": "designer",
  "displayName": "Designer",
  "description": "Employee permissions plus full task management and export",
  "color": "#EC4899",
  "isSystem": false,
  "permissions": [
    {"resource": "dashboard", "actions": ["view"]},
    {"resource": "tasks", "actions": ["view","create","edit","export"]},
    {"resource": "projects", "actions": ["view"]},
    {"resource": "attendance", "actions": ["view","create"]},
    {"resource": "leaves", "actions": ["view","create"]},
    {"resource": "employees", "actions": ["view"]},
    {"resource": "departments", "actions": ["view"]}
  ]
}'

echo ""
echo "Done! Seeded 7 default roles."
# END DEV_ONLY
