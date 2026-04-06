import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
  const mongod = await MongoMemoryServer.create({
    instance: { dbName: 'nexora_auth_test' },
  });
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests-12345';
  process.env.JWT_EXPIRY = '15m';
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '1025';
  process.env.FRONTEND_URL = 'http://localhost:3003';
  (global as any).__MONGOD__ = mongod;
  console.log(`\n🧪 Test MongoDB started at ${uri}\n`);
}
