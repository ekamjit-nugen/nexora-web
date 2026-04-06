import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import * as mongoose from 'mongoose';

describe('Member Lifecycle (E2E)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let orgId: string;

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

    // Setup: Create owner with org
    await request(app.getHttpServer()).post('/api/v1/auth/send-otp').send({ email: 'owner@lifecycle.com' });
    const ownerDoc = await mongoose.connection.collection('users').findOne({ email: 'owner@lifecycle.com' });
    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({ email: 'owner@lifecycle.com', otp: ownerDoc.otp });
    ownerToken = verifyRes.body.data.accessToken;

    const orgRes = await request(app.getHttpServer())
      .post('/api/v1/auth/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Lifecycle Org' });
    orgId = orgRes.body.data.organization._id;
  });

  it('should invite member and list them', async () => {
    // Invite
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/auth/organizations/${orgId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'member@lifecycle.com', firstName: 'Test', lastName: 'Member', role: 'developer' })
      .expect(201);
    expect(inviteRes.body.success).toBe(true);

    // List members
    const membersRes = await request(app.getHttpServer())
      .get(`/api/v1/auth/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(membersRes.body.data.length).toBe(2); // owner + invited
  });

  it('should prevent duplicate invitation', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/auth/organizations/${orgId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'dup@lifecycle.com', firstName: 'Dup', lastName: 'User', role: 'developer' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/auth/organizations/${orgId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'dup@lifecycle.com', firstName: 'Dup', lastName: 'User', role: 'developer' })
      .expect(409);
  });

  it('should get settings completeness', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/settings/completeness')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.data.percentage).toBeGreaterThanOrEqual(0);
    expect(res.body.data.categories).toBeTruthy();
    expect(res.body.data.nextAction).toBeTruthy();
  });

  it('should update settings and verify persistence', async () => {
    // Update business details
    await request(app.getHttpServer())
      .put('/api/v1/settings/business')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        registeredAddress: { line1: '123 Test St', city: 'TestCity', state: 'TS', pincode: '123456' },
        pan: 'ABCDE1234F',
        contactEmail: 'org@test.com',
      })
      .expect(200);

    // Read back
    const getRes = await request(app.getHttpServer())
      .get('/api/v1/settings/business')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(getRes.body.data.pan).toBe('ABCDE1234F');
    expect(getRes.body.data.registeredAddress.city).toBe('TestCity');
  });
});
