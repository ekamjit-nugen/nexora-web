#!/bin/bash
# DEV_ONLY: Seed policy templates (idempotent — skips existing)
# Run: bash scripts/seed-policies.sh

API="${1:-http://localhost:3005}"

echo "=== Nexora Policy Template Seeder ==="

TOKEN=$(curl -s -X POST "$API/api/v1/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@nexora.io","password":"Admin@123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then echo "Login failed"; exit 1; fi
echo "Authenticated."

# Get existing template names to skip duplicates
EXISTING=$(curl -s "$API/api/v1/policies/templates" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for p in d.get('data',[]): print(p['policyName'])
" 2>/dev/null)

create() {
  local NAME="$1"; local DATA="$2"
  if echo "$EXISTING" | grep -qF "$NAME"; then
    echo "  SKIP: $NAME (exists)"
    return
  fi
  curl -s -X POST "$API/api/v1/policies" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$DATA" > /dev/null 2>&1
  echo "  OK: $NAME"
}

echo "Seeding..."

create "Standard 9-to-6" '{"policyName":"Standard 9-to-6","description":"Standard office hours, 8h/day, 40h/week","type":"work_timing","isTemplate":true,"templateName":"Standard 9-to-6","workTiming":{"startTime":"09:00","endTime":"18:00","timezone":"Asia/Kolkata","graceMinutes":15,"minWorkingHours":8,"breakMinutes":60},"maxWorkingHoursPerWeek":40,"alerts":{"lateArrival":true,"earlyDeparture":true,"missedClockIn":true,"overtimeAlert":true}}'

create "Flexible Hours" '{"policyName":"Flexible Hours","description":"Wide timing window, 6h minimum","type":"work_timing","isTemplate":true,"templateName":"Flexible Hours","workTiming":{"startTime":"08:00","endTime":"20:00","timezone":"Asia/Kolkata","graceMinutes":60,"minWorkingHours":6,"breakMinutes":60},"maxWorkingHoursPerWeek":30,"alerts":{"lateArrival":true,"earlyDeparture":false,"missedClockIn":true,"overtimeAlert":true}}'

create "Night Shift" '{"policyName":"Night Shift","description":"Overnight shift policy","type":"work_timing","isTemplate":true,"templateName":"Night Shift","workTiming":{"startTime":"22:00","endTime":"07:00","timezone":"Asia/Kolkata","graceMinutes":15,"minWorkingHours":8,"breakMinutes":60},"maxWorkingHoursPerWeek":40,"alerts":{"lateArrival":true,"earlyDeparture":true,"missedClockIn":true,"overtimeAlert":true}}'

create "Remote First" '{"policyName":"Remote First","description":"WFH-friendly, flexible timing","type":"wfh","isTemplate":true,"templateName":"Remote First","workTiming":{"startTime":"08:00","endTime":"20:00","timezone":"Asia/Kolkata","graceMinutes":30,"minWorkingHours":7,"breakMinutes":60},"wfhPolicy":{"maxDaysPerMonth":20,"requiresApproval":false,"allowedDays":["Monday","Tuesday","Wednesday","Thursday","Friday"]},"maxWorkingHoursPerWeek":35,"alerts":{"lateArrival":false,"earlyDeparture":false,"missedClockIn":true,"overtimeAlert":true}}'

create "Standard Leave Policy" '{"policyName":"Standard Leave Policy","description":"Complete leave policy — Casual 12, Sick 12, Earned 15, WFH 24, Maternity 182, Paternity 14, Bereavement 5, Comp-Off, LOP. Indian labor law compliant.","type":"leave","isTemplate":true,"templateName":"Standard Leave Policy","leavePolicy":{"yearStart":"january","probationLeaveAllowed":false,"halfDayAllowed":true,"backDatedLeaveMaxDays":7,"leaveTypes":[{"type":"casual","label":"Casual Leave","annualAllocation":12,"accrualFrequency":"monthly","accrualAmount":1,"maxCarryForward":3,"encashable":false,"maxConsecutiveDays":3,"requiresDocument":false,"applicableTo":"all","minServiceMonths":0},{"type":"sick","label":"Sick Leave","annualAllocation":12,"accrualFrequency":"monthly","accrualAmount":1,"maxCarryForward":6,"encashable":false,"maxConsecutiveDays":5,"requiresDocument":true,"applicableTo":"all","minServiceMonths":0},{"type":"earned","label":"Earned / Privilege Leave","annualAllocation":15,"accrualFrequency":"monthly","accrualAmount":1.25,"maxCarryForward":30,"encashable":true,"maxConsecutiveDays":15,"requiresDocument":false,"applicableTo":"all","minServiceMonths":12},{"type":"wfh","label":"Work From Home","annualAllocation":24,"accrualFrequency":"monthly","accrualAmount":2,"maxCarryForward":0,"encashable":false,"maxConsecutiveDays":5,"requiresDocument":false,"applicableTo":"all","minServiceMonths":0},{"type":"maternity","label":"Maternity Leave","annualAllocation":182,"accrualFrequency":"on_request","accrualAmount":182,"maxCarryForward":0,"encashable":false,"maxConsecutiveDays":182,"requiresDocument":true,"applicableTo":"female","minServiceMonths":12},{"type":"paternity","label":"Paternity Leave","annualAllocation":14,"accrualFrequency":"on_request","accrualAmount":14,"maxCarryForward":0,"encashable":false,"maxConsecutiveDays":14,"requiresDocument":true,"applicableTo":"male","minServiceMonths":6},{"type":"bereavement","label":"Bereavement Leave","annualAllocation":5,"accrualFrequency":"on_request","accrualAmount":5,"maxCarryForward":0,"encashable":false,"maxConsecutiveDays":5,"requiresDocument":false,"applicableTo":"all","minServiceMonths":0},{"type":"comp_off","label":"Compensatory Off","annualAllocation":0,"accrualFrequency":"on_request","accrualAmount":0,"maxCarryForward":5,"encashable":false,"maxConsecutiveDays":3,"requiresDocument":false,"applicableTo":"all","minServiceMonths":0},{"type":"lop","label":"Loss of Pay","annualAllocation":0,"accrualFrequency":"on_request","accrualAmount":0,"maxCarryForward":0,"encashable":false,"maxConsecutiveDays":365,"requiresDocument":false,"applicableTo":"all","minServiceMonths":0}]},"alerts":{"lateArrival":false,"earlyDeparture":false,"missedClockIn":false,"overtimeAlert":false}}'

echo ""
echo "=== Done ==="
