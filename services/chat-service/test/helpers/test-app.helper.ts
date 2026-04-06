import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';

const TEST_JWT_SECRET = 'test-secret-key';
const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/nexora_chat_test';

/**
 * Creates a test NestJS application with real MongoDB connection.
 * Use for integration tests that need actual database operations.
 */
export async function createTestApp(modules: any[]): Promise<{ app: INestApplication; module: TestingModule }> {
  const moduleBuilder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      MongooseModule.forRoot(TEST_MONGO_URI, { retryAttempts: 1 }),
      JwtModule.register({ secret: TEST_JWT_SECRET }),
      ...modules,
    ],
  });

  const module = await moduleBuilder.compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api/v1');
  await app.init();

  return { app, module };
}

/**
 * Generate a test JWT token.
 */
export function generateTestToken(jwtService: JwtService, payload: {
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
  orgRole?: string;
}): string {
  return jwtService.sign({
    sub: payload.sub,
    email: payload.email,
    firstName: payload.firstName || 'Test',
    lastName: payload.lastName || 'User',
    roles: ['user'],
    organizationId: payload.organizationId || 'test-org-id',
    orgRole: payload.orgRole || 'admin',
    isPlatformAdmin: false,
  });
}

/**
 * Clean up a specific MongoDB collection.
 */
export async function clearCollection(module: TestingModule, modelName: string): Promise<void> {
  try {
    const model = module.get(`${modelName}Model`);
    await model.deleteMany({});
  } catch {
    // Model may not be registered — skip
  }
}

/**
 * Clean up all test data from common collections.
 */
export async function clearAllCollections(module: TestingModule): Promise<void> {
  const collections = ['Conversation', 'Message', 'ChatSettings', 'FlaggedMessage',
    'ChannelCategory', 'UserPresence', 'Bookmark', 'RetentionPolicy', 'LegalHold',
    'DlpRule', 'Webhook'];
  for (const name of collections) {
    await clearCollection(module, name);
  }
}
