# Test Agent: Multi-Tenancy
Run: `npx ts-node tests/e2e/multi-tenancy.test.ts`
Covers: Cross-org data isolation for all modules
Expected: 10+ test cases
CRITICAL: All must pass — data leakage is a security issue
On failure: Check API gateway and service logs
