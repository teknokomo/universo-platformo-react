const path = require('path')

const repoRoot = path.resolve(__dirname, '..', '..', '..')

/**
 * Shared Jest configuration for backend services.
 * Individual apps can import and extend this base configuration
 * to keep testing behaviour consistent across the monorepo.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  setupFiles: [path.join(__dirname, 'setupFiles.ts')],
  setupFilesAfterEnv: [path.join(__dirname, 'setupAfterEnv.ts')],
  testMatch: ['**/__tests__/**/*.test.[tj]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
  moduleNameMapper: {
    '^@testing/backend/(.*)$': path.join(__dirname, '$1'),
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@universo/auth-backend$': path.join(repoRoot, 'packages/auth-backend/base/dist/index.js'),
    '^@universo/auth-backend/(.*)$': path.join(repoRoot, 'packages/auth-backend/base/dist/$1')
  },
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{ts,tsx}',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/**/__tests__/**',
    '!<rootDir>/src/**/tests/**'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'cobertura'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: path.join(repoRoot, 'tsconfig.test.json')
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!@universo)',
    'packages/.*/base/dist'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/dist'
  ]
}
