export enum SetupStage {
  OTP_VERIFIED = 'otp_verified',
  ORG_CREATED = 'org_created',
  PROFILE_COMPLETE = 'profile_complete',
  COMPLETE = 'complete',
  INVITED = 'invited',
}

export enum MembershipStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  INVITED = 'invited',
  DEACTIVATED = 'deactivated',
  REMOVED = 'removed',
  SUSPENDED = 'suspended',
}

export const ROLE_HIERARCHY: Record<string, number> = {
  owner: 100,
  admin: 90,
  hr: 70,
  manager: 60,
  developer: 40,
  designer: 40,
  employee: 10,
};
