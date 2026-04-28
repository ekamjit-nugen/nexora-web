import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OrgMembershipGuard } from '../org-membership.guard';

describe('OrgMembershipGuard', () => {
  let guard: OrgMembershipGuard;
  let mockMembershipModel: any;

  beforeEach(async () => {
    mockMembershipModel = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgMembershipGuard,
        { provide: getModelToken('OrgMembership'), useValue: mockMembershipModel },
      ],
    }).compile();

    guard = module.get<OrgMembershipGuard>(OrgMembershipGuard);
  });

  function createMockContext(user: any, params: any = {}): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user, params }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as any;
  }

  // ── PRIVACY: Org Member Access ──

  it('should ALLOW access when user is an active member of the org', async () => {
    mockMembershipModel.findOne.mockResolvedValue({ userId: 'user-1', organizationId: 'org-1', status: 'active' });
    const context = createMockContext({ userId: 'user-1', sub: 'user-1' }, { id: 'org-1' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should ALLOW access when user has pending membership (invited)', async () => {
    mockMembershipModel.findOne.mockResolvedValue({ userId: 'user-1', organizationId: 'org-1', status: 'pending' });
    const context = createMockContext({ userId: 'user-1', sub: 'user-1' }, { id: 'org-1' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should DENY access when user is NOT a member of the org', async () => {
    mockMembershipModel.findOne.mockResolvedValue(null);
    const context = createMockContext({ userId: 'user-1', sub: 'user-1' }, { id: 'org-2' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should DENY access when user is deactivated in the org', async () => {
    // findOne filters by status: active/pending/invited — deactivated won't match
    mockMembershipModel.findOne.mockResolvedValue(null);
    const context = createMockContext({ userId: 'user-1', sub: 'user-1' }, { id: 'org-1' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should DENY access when user is removed from the org', async () => {
    mockMembershipModel.findOne.mockResolvedValue(null);
    const context = createMockContext({ userId: 'removed-user', sub: 'removed-user' }, { id: 'org-1' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  // ── PRIVACY: Cross-Org Isolation ──

  it('should DENY user from Org A accessing Org B members', async () => {
    // User is member of org-1 but tries to access org-2
    mockMembershipModel.findOne.mockResolvedValue(null); // No membership in org-2
    const context = createMockContext({ userId: 'user-in-org1', sub: 'user-in-org1' }, { id: 'org-2' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(mockMembershipModel.findOne).toHaveBeenCalledWith({
      userId: 'user-in-org1',
      organizationId: 'org-2',
      status: { $in: ['active', 'pending', 'invited'] },
    });
  });

  it('should DENY user from viewing another orgs settings via URL manipulation', async () => {
    mockMembershipModel.findOne.mockResolvedValue(null);
    const context = createMockContext({ userId: 'attacker', sub: 'attacker' }, { id: 'victim-org-id' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  // ── PRIVACY: Platform Admin Bypass ──

  it('should ALLOW platform admin to access ANY org', async () => {
    // Platform admin should NOT need a membership check
    const context = createMockContext({ userId: 'admin', sub: 'admin', isPlatformAdmin: true }, { id: 'any-org' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    // findOne should NOT be called for platform admin
    expect(mockMembershipModel.findOne).not.toHaveBeenCalled();
  });

  it('should DENY regular admin of Org A from accessing Org B (admin !== platform admin)', async () => {
    mockMembershipModel.findOne.mockResolvedValue(null);
    const context = createMockContext(
      { userId: 'org-a-admin', sub: 'org-a-admin', isPlatformAdmin: false, roles: ['admin'] },
      { id: 'org-b-id' },
    );
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  // ── PRIVACY: Edge Cases ──

  it('should ALLOW when no org ID in route params (non-org-scoped endpoint)', async () => {
    const context = createMockContext({ userId: 'user-1', sub: 'user-1' }, {});
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockMembershipModel.findOne).not.toHaveBeenCalled();
  });

  it('should DENY when no user in request (unauthenticated)', async () => {
    const context = createMockContext(null, { id: 'org-1' });
    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it('should work with :orgId param name (deactivate/reactivate endpoints)', async () => {
    mockMembershipModel.findOne.mockResolvedValue({ userId: 'user-1', status: 'active' });
    const context = createMockContext({ userId: 'user-1', sub: 'user-1' }, { orgId: 'org-1' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should attach membership to request for downstream use', async () => {
    const mockMembership = { userId: 'user-1', organizationId: 'org-1', status: 'active', role: 'admin' };
    mockMembershipModel.findOne.mockResolvedValue(mockMembership);
    const mockRequest: any = { user: { userId: 'user-1', sub: 'user-1' }, params: { id: 'org-1' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => mockRequest }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as any;
    await guard.canActivate(context);
    expect(mockRequest.orgMembership).toEqual(mockMembership);
  });

  // ── PRIVACY: Multi-Org User ──

  it('should ALLOW multi-org user to access Org A where they are member', async () => {
    mockMembershipModel.findOne.mockResolvedValue({ userId: 'multi-user', organizationId: 'org-a', status: 'active' });
    const context = createMockContext({ userId: 'multi-user', sub: 'multi-user' }, { id: 'org-a' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should DENY multi-org user from accessing Org C where they are NOT member', async () => {
    mockMembershipModel.findOne.mockResolvedValue(null);
    const context = createMockContext({ userId: 'multi-user', sub: 'multi-user' }, { id: 'org-c' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
