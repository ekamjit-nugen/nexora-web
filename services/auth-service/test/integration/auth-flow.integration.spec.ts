import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth/auth.service';
import { OrganizationService } from '../../src/auth/organization.service';
import * as mongoose from 'mongoose';

describe('Auth Flow Integration', () => {
  let authService: AuthService;
  let orgService: OrganizationService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    authService = module.get<AuthService>(AuthService);
    orgService = module.get<OrganizationService>(OrganizationService);
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await module.close();
  });

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  // Tests:
  it('should send OTP and create pending user', async () => {
    const result = await authService.sendOtp('newuser@test.com');
    expect(result.sent).toBe(true);
    expect(result.isNewUser).toBe(true);
    // Verify user created in DB
    const user = await mongoose.connection.collection('users').findOne({ email: 'newuser@test.com' });
    expect(user).toBeTruthy();
    expect(user.setupStage).toBe('otp_verified');
    expect(user.isActive).toBe(false);
  });

  it('should verify OTP and return user', async () => {
    // First send OTP
    await authService.sendOtp('verify@test.com');
    // Get the OTP from DB (it's stored in plain text for dev)
    const user = await mongoose.connection.collection('users').findOne({ email: 'verify@test.com' });
    // Read OTP directly since select:false
    const userWithOtp = await mongoose.connection.collection('users').findOne(
      { email: 'verify@test.com' },
    );
    const otp = userWithOtp.otp;
    expect(otp).toBeTruthy();
    expect(otp).toHaveLength(6);

    const result = await authService.verifyOtp('verify@test.com', otp);
    expect(result.verified).toBe(true);
    expect(result.user.email).toBe('verify@test.com');
    expect(result.route.route).toBe('/auth/setup-organization');
    expect(result.route.reason).toBe('new_user');
  });

  it('should reject wrong OTP', async () => {
    await authService.sendOtp('wrong@test.com');
    await expect(authService.verifyOtp('wrong@test.com', '999999')).rejects.toThrow();
  });

  it('should rate limit OTP requests', async () => {
    // Send 5 OTPs (the limit)
    for (let i = 0; i < 5; i++) {
      await authService.sendOtp('ratelimit@test.com');
      // Reset cooldown by manipulating DB directly
      await mongoose.connection.collection('users').updateOne(
        { email: 'ratelimit@test.com' },
        { $set: { otpLastRequestedAt: new Date(Date.now() - 60000) } }
      );
    }
    // 6th should fail
    await expect(authService.sendOtp('ratelimit@test.com')).rejects.toThrow();
  });

  it('should create organization after OTP verification', async () => {
    await authService.sendOtp('orgcreator@test.com');
    const userDoc = await mongoose.connection.collection('users').findOne({ email: 'orgcreator@test.com' });
    const otp = userDoc.otp;
    const verifyResult = await authService.verifyOtp('orgcreator@test.com', otp);

    // Create org
    const orgResult = await orgService.createOrganization(
      { name: 'Test Org', industry: 'Technology', size: '11-50' } as any,
      verifyResult.user._id.toString(),
    );

    expect(orgResult.organization.name).toBe('Test Org');
    expect(orgResult.organization.slug).toBe('test-org');
    expect(orgResult.membership.role).toBe('owner');
    expect(orgResult.membership.status).toBe('active');

    // Verify roles were seeded
    const roles = await mongoose.connection.collection('roles').find({
      organizationId: orgResult.organization._id.toString()
    }).toArray();
    expect(roles.length).toBeGreaterThanOrEqual(6); // owner, admin, hr, manager, developer, designer, employee

    // Verify user setupStage updated
    const updatedUser = await mongoose.connection.collection('users').findOne({ email: 'orgcreator@test.com' });
    expect(updatedUser.setupStage).toBe('org_created');
  });
});
