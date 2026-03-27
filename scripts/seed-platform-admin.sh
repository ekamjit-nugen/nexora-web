#!/bin/bash
# DEV_ONLY: Seed script to create platform admin user
# Run: bash scripts/seed-platform-admin.sh

API="http://localhost:3005/api/v1"

echo "=== Setting up Platform Admin ==="

# Step 1: Send OTP to platform admin email
echo "1. Sending OTP to platform@nexora.io..."
curl -s -X POST $API/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"platform@nexora.io"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   {d.get(\"message\", d.get(\"error\",\"?\"))}')" 2>/dev/null

# Step 2: Verify OTP (dev OTP is 000000)
echo "2. Verifying OTP..."
curl -s -X POST $API/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"platform@nexora.io","otp":"000000"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   {d.get(\"message\", d.get(\"error\",\"?\"))}')" 2>/dev/null

# Step 3: Set isPlatformAdmin flag directly in MongoDB
echo "3. Setting isPlatformAdmin flag in MongoDB..."
docker exec nexora-mongodb mongosh -u root -p nexora_dev_password --quiet --eval '
  const db = db.getSiblingDB("nexora_auth");

  const result = db.users.findOneAndUpdate(
    { email: "platform@nexora.io" },
    {
      $set: {
        isPlatformAdmin: true,
        isActive: true,
        firstName: "Platform",
        lastName: "Admin"
      }
    },
    { returnDocument: "after" }
  );

  if (result) {
    print("   Platform admin created: " + result.email + " (isPlatformAdmin: " + result.isPlatformAdmin + ")");
  } else {
    print("   ERROR: User platform@nexora.io not found");
  }
'

echo ""
echo "=== Platform Admin Setup Complete ==="
echo "Login: platform@nexora.io (use OTP 000000 in dev)"
echo "This user can access all /api/v1/platform/* endpoints"
