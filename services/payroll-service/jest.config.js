/**
 * Jest config for payroll-service.
 *
 * Scoped to the calc engines that compute employee pay:
 *   - gratuity (Payment of Gratuity Act 1972)
 *   - overtime bucketing + multipliers
 *   - LOP resolution (policy-driven)
 *
 * These are the formulas real customers depend on — worth testing
 * before anything else. Full integration-level coverage (maker-checker,
 * statutory exports, cross-service flows) is a follow-up sprint; this
 * file is the foundation.
 *
 * Unit tests run against the service classes directly with stubbed
 * dependencies — no nest-testing-module overhead, no mongo. The tests
 * stay in `src/__tests__` so they colocate with the code they exercise.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  // Skip the files that import mongo-dependent code paths.
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: ['payroll/payroll-calculation.service.ts', 'payroll/payroll.service.ts'],
};
