/**
 * Jest configuration for FactoryMind backend.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  // node-opcua transitively imports `hexy`, which ships ESM-only and breaks
  // CommonJS Jest. None of our tests exercise the OPC UA bridge — stub it out.
  moduleNameMapper: {
    '^hexy$': '<rootDir>/tests/stubs/hexy.js'
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  verbose: true,
  testTimeout: 10000
};
