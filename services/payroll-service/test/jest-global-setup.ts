import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Boots an in-process Mongo instance once for the entire integration
 * suite. The instance is reused across spec files (saves ~3s per
 * file), with `beforeEach(deleteMany)` in each spec providing
 * isolation. Stops in jest-global-teardown.
 *
 * `MONGODB_URI` is set on `process.env` so AppModule's MongooseModule
 * connects here instead of the dev container. Other env vars are set
 * to predictable values so tests don't accidentally talk to real
 * services (HR/attendance HTTP calls are mocked in each spec).
 */
export default async function globalSetup() {
  const mongod = await MongoMemoryServer.create({
    instance: { dbName: 'nexora_payroll_test' },
  });
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests-12345';
  // Point external service URLs at unreachable hosts so any forgotten
  // mock surfaces as a clear timeout/connection-refused rather than
  // accidentally hitting the dev environment.
  process.env.HR_SERVICE_URL = 'http://hr-service-unreachable:3010';
  process.env.ATTENDANCE_SERVICE_URL = 'http://attendance-service-unreachable:3011';
  process.env.POLICY_SERVICE_URL = 'http://policy-service-unreachable:3013';
  process.env.AUTH_SERVICE_URL = 'http://auth-service-unreachable:3001';
  (global as any).__MONGOD__ = mongod;
  console.log(`\n🧪 Test MongoDB started at ${uri}\n`);
}
