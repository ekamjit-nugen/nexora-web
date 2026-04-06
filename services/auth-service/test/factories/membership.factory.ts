import { MembershipStatus } from '../../src/common/constants/roles';
import { v4 as uuidv4 } from 'uuid';

export interface TestMembershipData {
  userId: string;
  organizationId: string;
  role: string;
  status: string;
  inviteToken?: string;
  inviteExpiresAt?: Date;
  invitedBy?: string;
  joinedAt?: Date;
  [key: string]: any;
}

export function createTestMembership(overrides: Partial<TestMembershipData> = {}): TestMembershipData {
  return {
    userId: '',
    organizationId: '',
    role: 'employee',
    status: MembershipStatus.ACTIVE,
    joinedAt: new Date(),
    ...overrides,
  };
}

export function createPendingInvite(overrides: Partial<TestMembershipData> = {}): TestMembershipData {
  return createTestMembership({
    status: MembershipStatus.PENDING,
    inviteToken: uuidv4(),
    inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    joinedAt: undefined,
    ...overrides,
  });
}
