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
