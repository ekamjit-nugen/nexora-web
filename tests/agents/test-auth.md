# Test Agent: Auth & Organization
Run: `npx ts-node tests/e2e/auth-org.test.ts`
Covers: Signup, login, OTP, org CRUD, invitations, roles, preferences
Expected: 20+ test cases
On failure: Check auth-service logs with `docker compose -f docker-compose.simple.yml logs auth-service --tail 50`
