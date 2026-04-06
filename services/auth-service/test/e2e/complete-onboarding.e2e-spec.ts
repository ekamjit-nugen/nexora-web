import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import * as mongoose from 'mongoose';

describe('Complete Onboarding (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await app.close();
  });

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  it('should complete full onboarding: OTP → Org → Profile → Dashboard', async () => {
    // Step 1: Send OTP
    const sendRes = await request(app.getHttpServer())
      .post('/api/v1/auth/send-otp')
      .send({ email: 'e2e@test.com' })
      .expect(200);
    expect(sendRes.body.success).toBe(true);

    // Step 2: Get OTP from DB
    const userDoc = await mongoose.connection.collection('users').findOne({ email: 'e2e@test.com' });
    const otp = userDoc.otp;
    expect(otp).toHaveLength(6);

    // Step 3: Verify OTP
    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({ email: 'e2e@test.com', otp })
      .expect(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.route).toBe('/auth/setup-organization');
    const accessToken = verifyRes.body.data.accessToken;
    expect(accessToken).toBeTruthy();

    // Step 4: Create Organization
    const orgRes = await request(app.getHttpServer())
      .post('/api/v1/auth/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'E2E Test Org', industry: 'Technology', size: '11-50' })
      .expect(201);
    expect(orgRes.body.success).toBe(true);
    const orgId = orgRes.body.data.organization._id;

    // Step 5: Complete Profile
    const profileRes = await request(app.getHttpServer())
      .post('/api/v1/auth/complete-profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'E2E', lastName: 'Tester' })
      .expect(200);
    expect(profileRes.body.success).toBe(true);

    // Step 6: Get current user — should be complete
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.data.firstName).toBe('E2E');
    expect(meRes.body.data.lastName).toBe('Tester');
    expect(meRes.body.data.isActive).toBe(true);
  });

  it('should reject invalid OTP', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/send-otp')
      .send({ email: 'bad@test.com' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({ email: 'bad@test.com', otp: '999999' })
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject empty email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/send-otp')
      .send({ email: '' })
      .expect(400);
  });

  it('should protect endpoints without auth', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);
  });

  it('should protect org creation without auth', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/organizations')
      .send({ name: 'No Auth Org' })
      .expect(401);
  });
});
