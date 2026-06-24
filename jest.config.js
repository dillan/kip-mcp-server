/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
  testMatch: ['**/tests/**/*.spec.ts', '**/src/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
    // Thin HTTP entrypoint shim (like src/index.ts); its logic lives in the
    // unit-tested src/http/* modules, and the built bin is covered by smoke:http.
    '!src/http-server.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { statements: 85, branches: 72, functions: 85, lines: 87 },
  },
};
