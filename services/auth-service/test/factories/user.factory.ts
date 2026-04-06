import { SetupStage } from '../../src/common/constants/roles';

export interface TestUserData {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  setupStage: string;
  isActive: boolean;
  organizations: string[];
  isPlatformAdmin: boolean;
  roles: string[];
  [key: string]: any;
}

export function createTestUser(overrides: Partial<TestUserData> = {}): TestUserData {
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    email: `test-${rand}@nexora-test.io`,
    firstName: 'Test',
    lastName: 'User',
    password: '$2b$10$dummyhash',
    setupStage: SetupStage.COMPLETE,
    isActive: true,
    organizations: [],
    isPlatformAdmin: false,
    roles: ['user'],
    preferences: { theme: 'system', language: 'en', timezone: 'Asia/Kolkata' },
    ...overrides,
  };
}

export function createTestAdmin(overrides: Partial<TestUserData> = {}): TestUserData {
  return createTestUser({ firstName: 'Admin', roles: ['admin'], ...overrides });
}

export function createTestInvitedUser(overrides: Partial<TestUserData> = {}): TestUserData {
  return createTestUser({ setupStage: SetupStage.INVITED, isActive: false, ...overrides });
}
