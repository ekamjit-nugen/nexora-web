# Nexora Test Agent: Run All Tests

## Instructions
Execute all test suites in parallel and report results.

### Prerequisites
1. Ensure Docker services are running: `docker compose -f docker-compose.simple.yml ps`
2. Clear test data: Run the MongoDB cleanup command
3. Install test dependencies: `cd tests && npm install`

### Execution
Run each test suite in parallel:
- `npx ts-node tests/e2e/auth-org.test.ts`
- `npx ts-node tests/e2e/hr-directory.test.ts`
- `npx ts-node tests/e2e/attendance.test.ts`
- `npx ts-node tests/e2e/leave.test.ts`
- `npx ts-node tests/e2e/projects.test.ts`
- `npx ts-node tests/e2e/tasks.test.ts`
- `npx ts-node tests/e2e/multi-tenancy.test.ts`
- `npx ts-node tests/business/business-logic.test.ts`

Or use the runner: `npx ts-node tests/runner.ts`

### After Tests
1. Check `tests/reports/latest.json` for results
2. Open http://localhost:3100/test-dashboard to view results
3. If tests fail, analyze errors and suggest fixes
4. Report business insights found during testing

### Cleanup
Clear test data after running:
```bash
docker exec nexora-mongodb mongosh -u root -p nexora_dev_password --quiet --eval '
["nexora_auth","nexora_hr","nexora_attendance","nexora_leave","nexora_projects","nexora_tasks"].forEach(d => {
  db = db.getSiblingDB(d);
  db.getCollectionNames().forEach(c => db[c].deleteMany({}));
});
print("ALL CLEARED");
'
```
