// Separate config from the unit-test default so we can boot a Mongo
// instance + the full Nest module per test file. `runInBand` matters
// here — the integration suite mutates a single in-memory Mongo
// instance, so parallel workers would step on each other.
export default {
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  testRegex: 'test/integration/.*\\.integration\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  maxWorkers: 1,
  globalSetup: './test/jest-global-setup.ts',
  globalTeardown: './test/jest-global-teardown.ts',
  testTimeout: 30000,
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
};
