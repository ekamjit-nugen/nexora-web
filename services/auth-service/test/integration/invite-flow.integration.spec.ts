import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth/auth.service';
import { OrganizationService } from '../../src/auth/organization.service';
import * as mongoose from 'mongoose';

describe('Invite Flow Integration', () => {
  let authService: AuthService;
  let orgService: OrganizationService;
  let module: TestingModule;
  let ownerId: string;
  let orgId: string;

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
    // Create owner + org for invite tests
    await authService.sendOtp('owner@test.com');
    const ownerDoc = await mongoose.connection.collection('users').findOne({ email: 'owner@test.com' });
    const otp = ownerDoc.otp;
    const verifyResult = await authService.verifyOtp('owner@test.com', otp);
    ownerId = verifyResult.user._id.toString();
    const orgResult = await orgService.createOrganization(
      { name: 'Invite Test Org' } as any,
      ownerId,
    );
    orgId = orgResult.organization._id.toString();
  });

  it('should invite a new member with pending status', async () => {
    const membership = await orgService.inviteMember(orgId, 'invited@test.com', 'developer', ownerId, 'John', 'Doe');
    expect(membership.status).toBe('pending');
    expect(membership.role).toBe('developer');
    expect(membership.inviteToken).toBeTruthy();
    expect(membership.inviteExpiresAt).toBeTruthy();

    // Verify invite expires in ~7 days
    const expiresIn = membership.inviteExpiresAt.getTime() - Date.now();
    expect(expiresIn).toBeGreaterThan(6 * 24 * 60 * 60 * 1000); // > 6 days
    expect(expiresIn).toBeLessThan(8 * 24 * 60 * 60 * 1000); // < 8 days
  });

  it('should prevent duplicate invitations', async () => {
    await orgService.inviteMember(orgId, 'dup@test.com', 'developer', ownerId, 'Jane', 'Doe');
    await expect(orgService.inviteMember(orgId, 'dup@test.com', 'developer', ownerId, 'Jane', 'Doe'))
      .rejects.toThrow();
  });

  it('should validate invite token', async () => {
    const membership = await orgService.inviteMember(orgId, 'validate@test.com', 'manager', ownerId, 'Val', 'User');
    const result = await authService.validateInviteToken(membership.inviteToken);
    expect(result.valid).toBe(true);
    expect(result.role).toBe('manager');
    expect(result.orgId).toBe(orgId);
  });

  it('should return invalid for non-existent token', async () => {
    const result = await authService.validateInviteToken('non-existent-token');
    expect(result.valid).toBe(false);
  });

  it('should accept invitation and activate membership', async () => {
    const membership = await orgService.inviteMember(orgId, 'accept@test.com', 'developer', ownerId, 'Acc', 'User');
    const invitedUserId = membership.userId;

    const accepted = await authService.acceptInvite(membership.inviteToken, invitedUserId);
    expect(accepted.status).toBe('active');
    expect(accepted.joinedAt).toBeTruthy();
    expect(accepted.inviteToken).toBeNull();

    // Verify user updated
    const user = await mongoose.connection.collection('users').findOne({ _id: new mongoose.Types.ObjectId(invitedUserId) });
    expect(user.setupStage).toBe('complete');
    expect(user.isActive).toBe(true);
  });

  it('should decline invitation', async () => {
    const membership = await orgService.inviteMember(orgId, 'decline@test.com', 'employee', ownerId, 'Dec', 'User');
    await authService.declineInvite(membership.inviteToken, membership.userId);

    const updated = await mongoose.connection.collection('orgmemberships').findOne({ _id: membership._id });
    expect(updated.status).toBe('removed');
    expect(updated.inviteToken).toBeNull();
  });

  it('should resend invite with new token', async () => {
    const membership = await orgService.inviteMember(orgId, 'resend@test.com', 'developer', ownerId, 'Res', 'User');
    const oldToken = membership.inviteToken;

    const resent = await orgService.resendInvite(orgId, 'resend@test.com', ownerId);
    expect(resent.inviteToken).toBeTruthy();
    expect(resent.inviteToken).not.toBe(oldToken);
  });

  it('should list org members including pending', async () => {
    await orgService.inviteMember(orgId, 'member1@test.com', 'developer', ownerId, 'M1', 'User');
    await orgService.inviteMember(orgId, 'member2@test.com', 'manager', ownerId, 'M2', 'User');

    const members = await orgService.getOrgMembers(orgId);
    expect(members.length).toBe(3); // owner + 2 invited

    const statuses = members.map(m => m.status);
    expect(statuses).toContain('active'); // owner
    expect(statuses).toContain('pending'); // invited members
  });
});
