export interface TestOrgData {
  name: string;
  slug: string;
  type: string;
  industry: string;
  size: string;
  country: string;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: string;
  settings: Record<string, any>;
  features: Record<string, any>;
  [key: string]: any;
}

export function createTestOrg(overrides: Partial<TestOrgData> = {}): TestOrgData {
  const rand = Math.random().toString(36).slice(2, 8);
  const name = overrides.name || `Test Org ${rand}`;
  return {
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    type: 'Product Company',
    industry: 'Technology',
    size: '11-50',
    country: 'IN',
    isActive: true,
    isDeleted: false,
    createdBy: '',
    onboardingCompleted: false,
    settings: { timezone: 'Asia/Kolkata', currency: 'INR', dateFormat: 'DD/MM/YYYY' },
    features: { projects: { enabled: true }, tasks: { enabled: true }, attendance: { enabled: false } },
    ...overrides,
  };
}
