module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: {
    '**/*.ts': {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
};

/*
 * When: Jest test runner initializes
 * if: jest.config.js is found in project root
 * then: apply configuration for TypeScript compilation and test discovery
 */
