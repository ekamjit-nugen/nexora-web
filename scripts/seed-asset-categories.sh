#!/bin/bash
# DEV_ONLY: Seed IT asset categories (idempotent — skips existing)
# Run: bash scripts/seed-asset-categories.sh

API="${1:-http://192.168.29.218:3005}"

echo "=== Nexora IT Asset Category Seeder ==="

TOKEN=$(curl -s -X POST "$API/api/v1/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@nexora.io","password":"Admin@123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then echo "Login failed"; exit 1; fi
echo "Authenticated."

# Get existing category names to skip duplicates
EXISTING=$(curl -s "$API/api/v1/assets/categories" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for c in d.get('data',[]): print(c['name'])
" 2>/dev/null)

create() {
  local NAME="$1"; local DATA="$2"
  if echo "$EXISTING" | grep -qF "$NAME"; then
    echo "  SKIP: $NAME (exists)"
    return
  fi
  curl -s -X POST "$API/api/v1/assets/categories" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$DATA" > /dev/null 2>&1
  echo "  OK: $NAME"
}

echo ""
echo "Seeding categories..."

create "Laptops" '{
  "name": "Laptops",
  "description": "Laptops and notebooks issued to employees",
  "icon": "💻",
  "depreciationMethod": "straight_line",
  "defaultUsefulLifeYears": 4,
  "customFields": [
    {"fieldName": "RAM", "fieldType": "select", "required": true, "options": ["8GB", "16GB", "32GB", "64GB"]},
    {"fieldName": "Storage", "fieldType": "select", "required": true, "options": ["256GB SSD", "512GB SSD", "1TB SSD", "2TB SSD"]},
    {"fieldName": "Processor", "fieldType": "text", "required": false}
  ]
}'

create "Monitors" '{
  "name": "Monitors",
  "description": "Desktop monitors and displays",
  "icon": "🖥️",
  "depreciationMethod": "straight_line",
  "defaultUsefulLifeYears": 5,
  "customFields": [
    {"fieldName": "Screen Size", "fieldType": "select", "required": true, "options": ["24 inch", "27 inch", "32 inch", "34 inch ultrawide"]},
    {"fieldName": "Resolution", "fieldType": "select", "required": false, "options": ["1080p", "1440p", "4K"]}
  ]
}'

create "Keyboards & Mice" '{
  "name": "Keyboards & Mice",
  "description": "Input peripherals — keyboards, mice, trackpads",
  "icon": "⌨️",
  "depreciationMethod": "straight_line",
  "defaultUsefulLifeYears": 3,
  "customFields": [
    {"fieldName": "Type", "fieldType": "select", "required": true, "options": ["Wired Keyboard", "Wireless Keyboard", "Wired Mouse", "Wireless Mouse", "Trackpad"]}
  ]
}'

create "Headsets & Audio" '{
  "name": "Headsets & Audio",
  "description": "Headsets, earbuds, speakers, and microphones",
  "icon": "🎧",
  "depreciationMethod": "straight_line",
  "defaultUsefulLifeYears": 3,
  "customFields": [
    {"fieldName": "Type", "fieldType": "select", "required": true, "options": ["Wired Headset", "Wireless Headset", "Earbuds", "Speakerphone", "Microphone"]}
  ]
}'

create "Mobile Devices" '{
  "name": "Mobile Devices",
  "description": "Company-issued phones and tablets",
  "icon": "📱",
  "depreciationMethod": "straight_line",
  "defaultUsefulLifeYears": 3,
  "customFields": [
    {"fieldName": "OS", "fieldType": "select", "required": true, "options": ["iOS", "Android"]},
    {"fieldName": "Storage", "fieldType": "select", "required": false, "options": ["64GB", "128GB", "256GB", "512GB"]}
  ]
}'

create "Networking Equipment" '{
  "name": "Networking Equipment",
  "description": "Routers, switches, access points, and cables",
  "icon": "🌐",
  "depreciationMethod": "straight_line",
  "defaultUsefulLifeYears": 5,
  "customFields": [
    {"fieldName": "Type", "fieldType": "select", "required": true, "options": ["Router", "Switch", "Access Point", "Firewall", "Cable/Adapter"]}
  ]
}'

create "Printers & Scanners" '{
  "name": "Printers & Scanners",
  "description": "Printers, scanners, and multifunction devices",
  "icon": "🖨️",
  "depreciationMethod": "straight_line",
  "defaultUsefulLifeYears": 5,
  "customFields": [
    {"fieldName": "Type", "fieldType": "select", "required": true, "options": ["Laser Printer", "Inkjet Printer", "Scanner", "Multifunction"]}
  ]
}'

create "Servers & Storage" '{
  "name": "Servers & Storage",
  "description": "Physical servers, NAS, and external storage devices",
  "icon": "🗄️",
  "depreciationMethod": "straight_line",
  "defaultUsefulLifeYears": 5,
  "customFields": [
    {"fieldName": "Type", "fieldType": "select", "required": true, "options": ["Rack Server", "Tower Server", "NAS", "External HDD", "External SSD"]},
    {"fieldName": "Capacity", "fieldType": "text", "required": false}
  ]
}'

create "Software Licenses" '{
  "name": "Software Licenses",
  "description": "Software licenses, subscriptions, and SaaS seats",
  "icon": "📄",
  "depreciationMethod": "none",
  "defaultUsefulLifeYears": 1,
  "customFields": [
    {"fieldName": "License Type", "fieldType": "select", "required": true, "options": ["Perpetual", "Annual Subscription", "Monthly Subscription", "Per-Seat"]},
    {"fieldName": "License Key", "fieldType": "text", "required": false}
  ]
}'

create "Office Furniture" '{
  "name": "Office Furniture",
  "description": "Desks, chairs, standing desks, and ergonomic accessories",
  "icon": "🪑",
  "depreciationMethod": "straight_line",
  "defaultUsefulLifeYears": 7,
  "customFields": [
    {"fieldName": "Type", "fieldType": "select", "required": true, "options": ["Desk", "Chair", "Standing Desk", "Monitor Arm", "Footrest", "Other"]}
  ]
}'

echo ""
echo "Done!"
