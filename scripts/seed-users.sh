#!/bin/bash
# DEV_ONLY: Seed script for test users with different roles
# Run: bash scripts/seed-users.sh

API="http://localhost:3005/api/v1"

echo "=== Seeding test users ==="

# Register HR user
echo "1. Creating HR user..."
curl -s -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"hr@nexora.io","password":"Hr@123456","firstName":"Priya","lastName":"Sharma"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   {d.get(\"message\", d.get(\"error\",\"?\"))}')" 2>/dev/null

# Register Employee users
echo "2. Creating Employee user (Dev)..."
curl -s -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@nexora.io","password":"Dev@123456","firstName":"Rahul","lastName":"Kumar"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   {d.get(\"message\", d.get(\"error\",\"?\"))}')" 2>/dev/null

echo "3. Creating Employee user (Designer)..."
curl -s -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"designer@nexora.io","password":"Design@123456","firstName":"Anita","lastName":"Verma"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   {d.get(\"message\", d.get(\"error\",\"?\"))}')" 2>/dev/null

echo "4. Creating Employee user (Manager)..."
curl -s -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@nexora.io","password":"Manager@123456","firstName":"Vikram","lastName":"Singh"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   {d.get(\"message\", d.get(\"error\",\"?\"))}')" 2>/dev/null

# Now update roles directly in MongoDB
echo ""
echo "=== Updating roles in MongoDB ==="

docker exec nexora-mongodb mongosh -u root -p nexora_dev_password --quiet --eval '
  use nexora_auth;

  // Set admin role
  let admin = db.users.findOneAndUpdate(
    { email: "admin@nexora.io" },
    { $set: { roles: ["admin", "super_admin"] } },
    { returnDocument: "after" }
  );
  print("Admin: " + admin.email + " -> roles: " + JSON.stringify(admin.roles));

  // Set HR role
  let hr = db.users.findOneAndUpdate(
    { email: "hr@nexora.io" },
    { $set: { roles: ["hr"] } },
    { returnDocument: "after" }
  );
  print("HR: " + hr.email + " -> roles: " + JSON.stringify(hr.roles));

  // Set employee roles
  let dev = db.users.findOneAndUpdate(
    { email: "dev@nexora.io" },
    { $set: { roles: ["employee", "developer"] } },
    { returnDocument: "after" }
  );
  print("Dev: " + dev.email + " -> roles: " + JSON.stringify(dev.roles));

  let designer = db.users.findOneAndUpdate(
    { email: "designer@nexora.io" },
    { $set: { roles: ["employee", "designer"] } },
    { returnDocument: "after" }
  );
  print("Designer: " + designer.email + " -> roles: " + JSON.stringify(designer.roles));

  let manager = db.users.findOneAndUpdate(
    { email: "manager@nexora.io" },
    { $set: { roles: ["employee", "manager"] } },
    { returnDocument: "after" }
  );
  print("Manager: " + manager.email + " -> roles: " + JSON.stringify(manager.roles));
'

echo ""
echo "=== Done! Test accounts ==="
echo "  admin@nexora.io    / Admin@123456    (admin, super_admin) - Cannot check in"
echo "  hr@nexora.io       / Hr@123456       (hr) - Can check in, can approve manual entries"
echo "  dev@nexora.io      / Dev@123456      (employee, developer)"
echo "  designer@nexora.io / Design@123456   (employee, designer)"
echo "  manager@nexora.io  / Manager@123456  (employee, manager)"
